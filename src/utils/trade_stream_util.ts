import WebSocket from 'ws';

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
  condition1: number;
  condition2: Date;
  contractId: number;
  callbacks: StreamCallbacks;
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

  private handleTradeMessage(message: any): void {
    // Debug: print ALL messages
    console.log('📨 Raw message received:', JSON.stringify(message, null, 2));
    
    // Check if this is a trade message and extract mint address
    if (message && typeof message === 'object') {
      const mintAddress = message.mint;
      
      if (mintAddress) {
        console.log(`🎯 Trade message for mint: ${mintAddress}`);
        
        if (this.streamConfigs.has(mintAddress)) {
          const config = this.streamConfigs.get(mintAddress)!;
          
          // Apply signer filter before calling onTrade
          if (this.shouldProcessTrade(message as TradeMessage, config)) {
            console.log(`✅ Trade passed signer filter for contract ${config.contractId}`);
            
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



      // Store stream configuration
      const config: StreamConfig = {
        mintAddress,
        signers: signers || [],
        condition1: condition1 || 0,
        condition2,
        contractId,
        callbacks
      };

      this.streamConfigs.set(mintAddress, config);
      this.subscriptions.add(mintAddress);

      console.log(`🔧 Stream configuration for contract ${contractId}:`, {
        mintAddress,
        signersCount: signers?.length || 0,
        condition1: `${condition1} (available for service logic)`,
        condition2: `${condition2.toISOString()} (available for service logic)`,
        contractId
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
    this.streamConfigs.delete(mintAddress);
    this.subscriptions.delete(mintAddress);
    
    // If no more subscriptions, close the WebSocket
    if (this.subscriptions.size === 0 && this.ws) {
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
  public getActiveStreams(): { mintAddress: string, contractId: number, signersCount: number }[] {
    return Array.from(this.streamConfigs.entries()).map(([mintAddress, config]) => ({
      mintAddress,
      contractId: config.contractId,
      signersCount: config.signers.length
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

/*
// Example usage with new parameters:
async function testEnhancedTradeStream() {
  const signers = [
    "7pDVmRPkc4qbkBXuDjLmsRhASi4c9CkV64i9wzkzcqep",
    "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2"
  ]; // List of wallet addresses to monitor
  
  const condition1 = 0.1; // Available for service logic (not used for filtering)
  const condition2 = new Date('2024-01-01T00:00:00Z'); // Available for service logic (not used for filtering)
  const contractId = 12345; // Contract/service identifier

  const result = await start_trades_stream(
    'FAtT2W7mJs27hHRCPiCfrBzASDpFNFQAYz2NXiEhpump', // Token mint address
    signers,
    condition1,
    condition2,
    contractId,
    (trade) => {
      console.log(`🔥 New signer-filtered trade for contract ${contractId}:`, {
        signature: trade.signature,
        mint: trade.mint,
        solAmount: trade.solAmount,
        tokenAmount: trade.tokenAmount,
        txType: trade.txType === 'buy' ? '🟢 BUY' : '🔴 SELL',
        traderPublicKey: trade.traderPublicKey,
        newTokenBalance: trade.newTokenBalance,
        bondingCurveKey: trade.bondingCurveKey,
        vTokensInBondingCurve: trade.vTokensInBondingCurve,
        vSolInBondingCurve: trade.vSolInBondingCurve,
        marketCapSol: trade.marketCapSol,
        pool: trade.pool,
        contractId: contractId
      });
    },
    (error) => {
      console.error(`❌ Stream error for contract ${contractId}:`, error);
    },
    () => {
      console.log(`✅ Connected to trade stream for contract ${contractId}`);
    },
    () => {
      console.log(`❌ Disconnected from trade stream for contract ${contractId}`);
    }
  );

  if (result.success) {
    console.log(`🚀 Enhanced trade stream started successfully for contract ${contractId}`);
    console.log('📊 Connection status:', getConnectionStatus());
    console.log('🎯 Active streams:', getActiveStreams());
    console.log('⚠️  Press Ctrl+C to stop gracefully');
  } else {
    console.error(`💥 Failed to start trade stream for contract ${contractId}:`, result.error);
  }
}*/

// Run the test
 //testEnhancedTradeStream().catch(console.error);
