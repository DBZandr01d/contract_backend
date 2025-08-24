// src/services/stream_manager_service.ts
import { start_trades_stream, stopTradeStream, getConnectionStatus, getActiveStreams, TradeMessage } from '../utils/trade_stream_util';
import { UserContractService } from './user_contract_service';
import { ContractService } from './contract_service';

interface ActiveStream {
  contractId: number;
  mintAddress: string;
  startedAt: Date;
  condition1: number;
  condition2: Date;
  signersCount: number;
}

export class StreamManagerService {
  private static activeStreams: Map<number, ActiveStream> = new Map();
  private static maxRetries = 5;
  private static baseRetryDelay = 1000; // 1 second

  // Convert database date string to Date object
  private static parseCondition2(condition2String: string): Date {
    try {
      // Format: "2025-09-25 18:23:00" -> ISO format
      const isoString = condition2String.replace(' ', 'T') + 'Z';
      const date = new Date(isoString);
      
      console.log(`📅 Parsing condition2: "${condition2String}" -> ${date.toISOString()}`);
      
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${condition2String}`);
      }
      
      return date;
    } catch (error) {
      console.error('❌ Failed to parse condition2 date:', error);
      throw new Error(`Invalid condition2 date format: ${condition2String}`);
    }
  }

  // Start stream for a contract with retry logic
  static async startStreamForContract(contractId: number, retryCount: number = 0): Promise<boolean> {
    try {
      console.log(`🚀 Starting stream for contract ${contractId} (attempt ${retryCount + 1}/${this.maxRetries + 1})`);
      
      // 1. Get contract details
      const contract = await ContractService.getContractById(contractId);
      if (!contract) {
        console.error(`❌ Contract ${contractId} not found`);
        return false;
      }

      console.log(`📄 Contract ${contractId} details:`, {
        mint: contract.mint,
        condition1: contract.condition1,
        condition2: contract.condition2,
        is_completed: contract.is_completed
      });

      // Skip if contract already completed
      if (contract.is_completed) {
        console.log(`⏭️ Contract ${contractId} already completed, skipping stream start`);
        return false;
      }

      // 2. Get signers (user addresses) from user_contract table
      const userContracts = await UserContractService.getUserContractsByContractId(contractId);
      const signers = userContracts.map(uc => uc.user_address);
      
      console.log(`👥 Found ${signers.length} signers for contract ${contractId}:`, signers);

      if (signers.length === 0) {
        console.log(`⚠️ No signers found for contract ${contractId}, skipping stream start`);
        return false;
      }

      // 3. Parse condition2 date
      const condition2Date = this.parseCondition2(contract.condition2);

      // Check if condition2 has already expired
      const now = new Date();
      if (now >= condition2Date) {
        console.log(`⏰ Contract ${contractId} has already expired (${condition2Date.toISOString()}), skipping stream start`);
        return false;
      }

      // 4. Start the trade stream
      const result = await start_trades_stream(
        contract.mint,
        signers,
        contract.condition1,
        condition2Date,
        contractId,
        // onTrade callback
        (trade: TradeMessage) => {
          console.log(`📊 Trade processed for contract ${contractId}:`, {
            trader: trade.traderPublicKey,
            txType: trade.txType,
            tokenAmount: trade.tokenAmount,
            solAmount: trade.solAmount,
            marketCapSol: trade.marketCapSol,
            newTokenBalance: trade.newTokenBalance
          });
        },
        // onError callback
        (error: string) => {
          console.error(`❌ Stream error for contract ${contractId}:`, error);
        },
        // onConnect callback
        () => {
          console.log(`✅ Stream connected for contract ${contractId}`);
        },
        // onDisconnect callback
        () => {
          console.log(`🔌 Stream disconnected for contract ${contractId}`);
          // Remove from active streams on disconnect
          this.activeStreams.delete(contractId);
        }
      );

      if (result.success) {
        // Store active stream info
        this.activeStreams.set(contractId, {
          contractId,
          mintAddress: contract.mint,
          startedAt: new Date(),
          condition1: contract.condition1,
          condition2: condition2Date,
          signersCount: signers.length
        });

        console.log(`🎉 Stream started successfully for contract ${contractId}`);
        console.log(`📊 Active streams: ${this.activeStreams.size}`);
        return true;
      } else {
        throw new Error(result.error || 'Unknown stream start error');
      }

    } catch (error) {
      console.error(`❌ Failed to start stream for contract ${contractId} (attempt ${retryCount + 1}):`, error);
      
      // Retry with exponential backoff
      if (retryCount < this.maxRetries) {
        const delay = this.baseRetryDelay * Math.pow(2, retryCount);
        console.log(`🔄 Retrying stream start for contract ${contractId} in ${delay}ms...`);
        
        setTimeout(async () => {
          await this.startStreamForContract(contractId, retryCount + 1);
        }, delay);
      } else {
        console.error(`💀 Max retries reached for contract ${contractId}. Stream start failed permanently.`);
      }
      
      return false;
    }
  }

  // Stop stream for a contract
  static async stopStreamForContract(contractId: number): Promise<boolean> {
    try {
      console.log(`🛑 Stopping stream for contract ${contractId}`);
      
      const activeStream = this.activeStreams.get(contractId);
      if (!activeStream) {
        console.log(`⚠️ No active stream found for contract ${contractId}`);
        return false;
      }

      // Stop the trade stream
      stopTradeStream(activeStream.mintAddress);
      
      // Remove from active streams
      this.activeStreams.delete(contractId);
      
      console.log(`✅ Stream stopped for contract ${contractId}`);
      console.log(`📊 Active streams: ${this.activeStreams.size}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to stop stream for contract ${contractId}:`, error);
      return false;
    }
  }

  // Get all active streams
  static getActiveStreams(): ActiveStream[] {
    return Array.from(this.activeStreams.values());
  }

  // Get specific active stream
  static getActiveStream(contractId: number): ActiveStream | undefined {
    return this.activeStreams.get(contractId);
  }

  // Check if stream is active for contract
  static isStreamActive(contractId: number): boolean {
    return this.activeStreams.has(contractId);
  }

  // Get stream connection status
  static getStreamConnectionStatus(): string {
    return getConnectionStatus();
  }

  // Get technical stream info from the underlying stream manager
  static getStreamTechnicalInfo() {
    return getActiveStreams();
  }

  // Restart stream for contract (stop then start)
  static async restartStreamForContract(contractId: number): Promise<boolean> {
    console.log(`🔄 Restarting stream for contract ${contractId}`);
    
    await this.stopStreamForContract(contractId);
    
    // Wait a moment before restarting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return await this.startStreamForContract(contractId);
  }

  // Start streams for all active contracts (useful for service startup)
  static async startStreamsForAllActiveContracts(): Promise<void> {
    try {
      console.log('🚀 Starting streams for all active contracts...');
      
      // Get all pending (not completed) contracts
      const contracts = await ContractService.getPendingContracts();
      console.log(`📋 Found ${contracts.length} pending contracts`);
      
      for (const contract of contracts) {
        // Start stream with a small delay between each to avoid overwhelming the system
        setTimeout(async () => {
          await this.startStreamForContract(contract.id);
        }, 100 * contract.id); // Stagger starts
      }
      
      console.log('✅ Initiated stream startup for all pending contracts');
      
    } catch (error) {
      console.error('❌ Failed to start streams for all contracts:', error);
    }
  }

  // Stop all active streams
  static async stopAllStreams(): Promise<void> {
    console.log('🛑 Stopping all active streams...');
    
    const contractIds = Array.from(this.activeStreams.keys());
    
    for (const contractId of contractIds) {
      await this.stopStreamForContract(contractId);
    }
    
    console.log('✅ All streams stopped');
  }
}