import WebSocket from 'ws';
import { UserContractService } from '../services/user_contract_service';
import { ContractService } from '../services/contract_service';
import { UserContractStatus } from '../config/supabase';

interface TradeMessage {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: 'buy' | 'sell';
  tokenAmount: number;
  solAmount: number;
  newTokenBalance: number;
  bondingCurveKey: string;
  vTokensInBondingCurve: number;
  vSolInBondingCurve: number;
  marketCapSol: number;
  pool: string;
  // Legacy fields for backward compatibility
  sol_amount?: number;
  token_amount?: number;
  is_buy?: boolean;
  user?: string;
  timestamp?: number;
  tx_index?: number;
  [key: string]: any; // For any additional fields from pump.fun
}

interface StreamResult {
  success: boolean;
  error?: string;
  websocket?: WebSocket;
}

interface StreamCallbacks {
  onTrade: (trade: TradeMessage) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface StreamConfig {
  mintAddress: string;
  signers: string[];
  condition1: number; // Market cap in USD
  condition2: Date;   // Timestamp condition
  contractId: number;
  callbacks: StreamCallbacks;
  allTimeHigh: number; // ATH in SOL for this stream
}

// Updated UserContract interface with status
interface UserContract {
  contract_id: number;
  user_address: string;
  supply: number;
  status: UserContractStatus;
}

// Type for SOL price API response
interface SolPriceResponse {
  solPrice?: number;
}

class TradeStreamManager {
  private ws: WebSocket | null = null;
  private isConnecting: boolean = false;
  private subscriptions: Set<string> = new Set();
  private streamConfigs: Map<string, StreamConfig> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Start with 1 second
  private wsUrl: string = 'wss://pumpportal.fun/api/data';

  private async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.on('open', () => {
          console.log('Connected to pump.fun WebSocket');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Resubscribe to all active subscriptions
          this.subscriptions.forEach(mintAddress => {
            this.subscribeToToken(mintAddress);
          });

          // Call onConnect callbacks
          this.streamConfigs.forEach(config => {
            if (config.callbacks.onConnect) {
              config.callbacks.onConnect();
            }
          });

          resolve(); // Resolve promise when connected
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleTradeMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          
          // Call onError callbacks
          this.streamConfigs.forEach(config => {
            if (config.callbacks.onError) {
              config.callbacks.onError(`WebSocket error: ${error.message}`);
            }
          });

          reject(error); // Reject promise on error
        });

        this.ws.on('close', (code, reason) => {
          console.log(`WebSocket closed: ${code} - ${reason}`);
          this.isConnecting = false;
          this.ws = null;
          
          // Call onDisconnect callbacks
          this.streamConfigs.forEach(config => {
            if (config.callbacks.onDisconnect) {
              config.callbacks.onDisconnect();
            }
          });

          // Attempt to reconnect if we have active subscriptions
          if (this.subscriptions.size > 0) {
            this.attemptReconnect();
          }
        });

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Giving up.');
      
      // Call onError callbacks
      this.streamConfigs.forEach(config => {
        if (config.callbacks.onError) {
          config.callbacks.onError('Max reconnection attempts reached');
        }
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection attempt failed:', error);
      });
    }, delay);
  }

  private subscribeToToken(mintAddress: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected, cannot subscribe');
      return;
    }

    const payload = {
      method: "subscribeTokenTrade",
      keys: [mintAddress]
    };

    this.ws.send(JSON.stringify(payload));
    console.log(`Subscribed to token trades for: ${mintAddress}`);
  }

  // Fetch SOL price from pump.fun API
  private async getSolPrice(): Promise<number> {
    try {
      console.log('🔍 Fetching SOL price from pump.fun API...');
      const response = await fetch('https://frontend-api-v3.pump.fun/sol-price');
      const data: SolPriceResponse = await response.json();
      const solPrice = data.solPrice;
      console.log(`💰 Current SOL price: ${solPrice}`);
      return solPrice;
    } catch (error) {
      console.error('❌ Failed to fetch SOL price:', error);
      throw error;
    }
  }

  // Check if condition2 (timestamp) has been reached
  private checkCondition2(config: StreamConfig): boolean {
    const currentTime = new Date();
    const hasExpired = currentTime >= config.condition2;
    
    console.log(`⏰ Condition2 check for contract ${config.contractId}:`);
    console.log(`   Current time: ${currentTime.toISOString()}`);
    console.log(`   Condition2 time: ${config.condition2.toISOString()}`);
    console.log(`   Has expired: ${hasExpired}`);
    
    return hasExpired;
  }

  // Update user contract status in database
  private async updateUserContractStatus(contractId: number, userAddress: string, status: UserContractStatus): Promise<void> {
    try {
      console.log(`🔄 Updating user contract status: contract=${contractId}, user=${userAddress}, status=${status}`);
      
      // Note: You'll need to add this method to UserContractService
      await UserContractService.updateUserContractStatus(contractId, userAddress, status);
      
      console.log(`✅ User contract status updated successfully`);
    } catch (error) {
      console.error('❌ Failed to update user contract status:', error);
      throw error;
    }
  }

  // Check if all users in contract have failed (status = 3)
  private async checkAllUsersFailed(contractId: number): Promise<boolean> {
    try {
      console.log(`🔍 Checking if all users failed for contract ${contractId}...`);
      
      const userContracts = await UserContractService.getUserContractsByContractId(contractId);
      const inProgressUsers = userContracts.filter(uc => uc.status === UserContractStatus.InProgress);
      
      console.log(`📊 Contract ${contractId} status:`);
      console.log(`   Total users: ${userContracts.length}`);
      console.log(`   In-progress users: ${inProgressUsers.length}`);
      
      const allFailed = inProgressUsers.length === 0;
      console.log(`   All users failed: ${allFailed}`);
      
      return allFailed;
    } catch (error) {
      console.error('❌ Failed to check user statuses:', error);
      throw error;
    }
  }

  // Complete contract successfully (condition1 met)
  private async completeContractSuccessfully(contractId: number): Promise<void> {
    try {
      console.log(`🎉 Completing contract ${contractId} successfully (condition1 met)...`);
      
      // Mark all in-progress users as successful (status = 1)
      const userContracts = await UserContractService.getUserContractsByContractId(contractId);
      const inProgressUsers = userContracts.filter(uc => uc.status === UserContractStatus.InProgress);
      
      console.log(`📝 Updating ${inProgressUsers.length} users to successful status...`);
      
      for (const userContract of inProgressUsers) {
        await this.updateUserContractStatus(contractId, userContract.user_address, UserContractStatus.CompletedCondition1);
      }
      
      // Mark contract as completed
      await ContractService.markContractCompleted(contractId);
      console.log(`✅ Contract ${contractId} marked as completed`);
      
    } catch (error) {
      console.error('❌ Failed to complete contract successfully:', error);
      throw error;
    }
  }

  // Complete contract due to all users failing
  private async completeContractAllFailed(contractId: number): Promise<void> {
    try {
      console.log(`💀 Completing contract ${contractId} - all users failed...`);
      
      // Mark contract as completed
      await ContractService.markContractCompleted(contractId);
      console.log(`✅ Contract ${contractId} marked as completed (all users failed)`);
      
    } catch (error) {
      console.error('❌ Failed to complete contract (all failed):', error);
      throw error;
    }
  }

  private shouldProcessTrade(trade: TradeMessage, config: StreamConfig): boolean {
    try {
      // Check signers condition - if signers list is provided and not empty, only process trades from those signers
      if (config.signers && config.signers.length > 0) {
        // Check both old and new field names for trader address
        const traderAddress = trade.traderPublicKey || trade.user;
        
        if (!traderAddress || !config.signers.includes(traderAddress)) {
          console.log(`👤 Trade filtered out: trader ${traderAddress || 'unknown'} not in signers list`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking trade conditions:', error);
      return false;
    }
  }

  private async handleTradeMessage(message: any): Promise<void> {
    // Debug: print ALL messages
    console.log('📨 Raw message received:', JSON.stringify(message, null, 2));
    
    // Check if this is a trade message and extract mint address
    if (message && typeof message === 'object') {
      const mintAddress = message.mint;
      
      if (mintAddress) {
        console.log(`🎯 Trade message for mint: ${mintAddress}`);
        
        if (this.streamConfigs.has(mintAddress)) {
          const config = this.streamConfigs.get(mintAddress)!;
          
          // Check condition2 (timestamp) first
          if (this.checkCondition2(config)) {
            console.log(`⏰ Contract ${config.contractId} has expired (condition2 reached)`);
            console.log(`🔒 Closing stream for contract ${config.contractId}`);
            this.stopTradeStream(mintAddress);
            return;
          }
          
          // Apply signer filter before processing
          if (this.shouldProcessTrade(message as TradeMessage, config)) {
            console.log(`✅ Trade passed signer filter for contract ${config.contractId}`);
            
            // Process the trade with contract logic
            await this.processTradeWithContractLogic(message as TradeMessage, config);
            
            if (config.callbacks.onTrade) {
              try {
                config.callbacks.onTrade(message as TradeMessage);
              } catch (error) {
                console.error('Error in trade callback:', error);
                if (config.callbacks.onError) {
                  config.callbacks.onError(`Trade callback error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }
            }
          } else {
            console.log(`❌ Trade filtered out by signer filter for contract ${config.contractId}`);
          }
        } else {
          console.log(`⚠️  No callback registered for mint: ${mintAddress}`);
        }
      } else {
        console.log('ℹ️  Message without mint (probably system message)');
      }
    }
  }

  // New method to handle contract logic for each trade
  private async processTradeWithContractLogic(trade: TradeMessage, config: StreamConfig): Promise<void> {
    try {
      console.log(`🔄 Processing trade with contract logic for contract ${config.contractId}...`);
      
      // Update ATH if current market cap is higher
      if (trade.marketCapSol > config.allTimeHigh) {
        config.allTimeHigh = trade.marketCapSol;
        console.log(`📈 New ATH for contract ${config.contractId}: ${config.allTimeHigh} SOL`);
      }
      
      // Check condition1 (market cap in USD)
      const solPrice = await this.getSolPrice();
      const currentMarketCapUSD = trade.marketCapSol * solPrice;
      const athMarketCapUSD = config.allTimeHigh * solPrice;
      
      console.log(`💹 Market cap analysis for contract ${config.contractId}:`);
      console.log(`   Current market cap: ${trade.marketCapSol} SOL (~$${currentMarketCapUSD.toFixed(2)})`);
      console.log(`   ATH market cap: ${config.allTimeHigh} SOL (~$${athMarketCapUSD.toFixed(2)})`);
      console.log(`   Condition1 target: $${config.condition1}`);
      
      if (athMarketCapUSD >= config.condition1) {
        console.log(`🎉 CONTRACT SUCCESSFUL! ATH reached condition1 for contract ${config.contractId}`);
        await this.completeContractSuccessfully(config.contractId);
        console.log(`🔒 Closing stream for successful contract ${config.contractId}`);
        this.stopTradeStream(config.mintAddress);
        return;
      }
      
      // Check if trade is from a signer (user in the contract)
      const traderAddress = trade.traderPublicKey || trade.user;
      if (traderAddress && config.signers.includes(traderAddress)) {
        console.log(`👤 Processing trade from signer: ${traderAddress}`);
        
        // Get user's supply requirement from database
        const userContract = await UserContractService.getUserContract(config.contractId, traderAddress);
        
        if (!userContract) {
          console.log(`⚠️  User contract not found for contract ${config.contractId} and user ${traderAddress}`);
          return;
        }
        
        console.log(`📊 User contract data:`, {
          contractId: config.contractId,
          userAddress: traderAddress,
          requiredSupply: userContract.supply,
          currentBalance: trade.newTokenBalance,
          currentStatus: userContract.status
        });
        
        // Only check users who are still in progress (status = 0)
        if (userContract.status === UserContractStatus.InProgress) {
          // Check if user's new balance is less than required supply
          if (trade.newTokenBalance < userContract.supply) {
            console.log(`💀 USER FAILED CONTRACT! Balance ${trade.newTokenBalance} < Required ${userContract.supply}`);
            console.log(`   Contract: ${config.contractId}, User: ${traderAddress}`);
            
            // Set user status to failed (status = 3)
            await this.updateUserContractStatus(config.contractId, traderAddress, UserContractStatus.Broken);
            
            // Check if all users have failed
            const allUsersFailed = await this.checkAllUsersFailed(config.contractId);
            if (allUsersFailed) {
              console.log(`💀 All users failed for contract ${config.contractId}`);
              await this.completeContractAllFailed(config.contractId);
              console.log(`🔒 Closing stream for failed contract ${config.contractId}`);
              this.stopTradeStream(config.mintAddress);
              return;
            }
          } else {
            console.log(`✅ User balance check passed: ${trade.newTokenBalance} >= ${userContract.supply}`);
          }
        } else {
          console.log(`ℹ️  User already has final status: ${userContract.status}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing trade with contract logic:', error);
    }
  }

  public async startTradeStream(
    mintAddress: string,
    signers: string[],
    condition1: number,
    condition2: Date,
    contractId: number,
    callbacks: StreamCallbacks
  ): Promise<StreamResult> {
    try {
      // Validate mint address format (basic check)
      if (!mintAddress || mintAddress.length < 32) {
        return {
          success: false,
          error: 'Invalid mint address format'
        };
      }

      // Store stream configuration with initial ATH of 0
      const config: StreamConfig = {
        mintAddress,
        signers: signers || [],
        condition1: condition1 || 0,
        condition2,
        contractId,
        callbacks,
        allTimeHigh: 0 // Initialize ATH to 0
      };

      this.streamConfigs.set(mintAddress, config);
      this.subscriptions.add(mintAddress);

      console.log(`🔧 Stream configuration for contract ${contractId}:`, {
        mintAddress,
        signersCount: signers?.length || 0,
        condition1: `$${condition1} USD (market cap target)`,
        condition2: `${condition2.toISOString()} (expiration time)`,
        contractId,
        initialATH: 0
      });

      // Connect and wait for connection to be established
      await this.connect();

      return {
        success: true,
        websocket: this.ws || undefined
      };

    } catch (error) {
      console.error('Failed to start trade stream:', error);
      
      // Clean up on failure
      this.streamConfigs.delete(mintAddress);
      this.subscriptions.delete(mintAddress);
      
      return {
        success: false,
        error: `Failed to start trade stream: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Method to stop streaming for a specific mint (for future use)
  public stopTradeStream(mintAddress: string): void {
    console.log(`🛑 Stopping trade stream for mint: ${mintAddress}`);
    this.streamConfigs.delete(mintAddress);
    this.subscriptions.delete(mintAddress);
    
    // If no more subscriptions, close the WebSocket
    if (this.subscriptions.size === 0 && this.ws) {
      console.log(`🔌 Closing WebSocket connection (no more subscriptions)`);
      this.ws.close();
    }
  }

  // Method to get connection status
  public getConnectionStatus(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'unknown';
    }
  }

  // Method to get active stream configs
  public getActiveStreams(): { mintAddress: string, contractId: number, signersCount: number, currentATH: number }[] {
    return Array.from(this.streamConfigs.entries()).map(([mintAddress, config]) => ({
      mintAddress,
      contractId: config.contractId,
      signersCount: config.signers.length,
      currentATH: config.allTimeHigh
    }));
  }

  // Method to gracefully close all connections
  public async closeAll(): Promise<void> {
    console.log('🔄 Closing all trade streams...');
    
    // Clear all subscriptions and callbacks
    this.subscriptions.clear();
    this.streamConfigs.clear();
    
    // Close WebSocket connection gracefully
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return new Promise((resolve) => {
        this.ws!.on('close', () => {
          console.log('✅ All trade streams closed');
          resolve();
        });
        this.ws!.close();
      });
    } else {
      console.log('✅ All trade streams closed (no active connection)');
    }
  }
}

// Create a singleton instance
const tradeStreamManager = new TradeStreamManager();

// Main function with updated signature to include new parameters
export async function start_trades_stream(
  mintAddress: string,
  signers: string[],
  condition1: number,
  condition2: Date,
  contractId: number,
  onTrade: (trade: TradeMessage) => void,
  onError?: (error: string) => void,
  onConnect?: () => void,
  onDisconnect?: () => void
): Promise<StreamResult> {
  return tradeStreamManager.startTradeStream(
    mintAddress,
    signers,
    condition1,
    condition2,
    contractId,
    {
      onTrade,
      onError,
      onConnect,
      onDisconnect
    }
  );
}

// Export additional utilities
export { TradeMessage, StreamResult, StreamCallbacks, StreamConfig };
export const getConnectionStatus = () => tradeStreamManager.getConnectionStatus();
export const getActiveStreams = () => tradeStreamManager.getActiveStreams();
export const stopTradeStream = (mintAddress: string) => tradeStreamManager.stopTradeStream(mintAddress);
export const closeAllStreams = () => tradeStreamManager.closeAll();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT (Ctrl+C). Shutting down gracefully...');
  await tradeStreamManager.closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM. Shutting down gracefully...');
  await tradeStreamManager.closeAll();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught Exception:', error);
  await tradeStreamManager.closeAll();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  await tradeStreamManager.closeAll();
  process.exit(1);
});