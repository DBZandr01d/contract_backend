import WebSocket from 'ws';

interface TradeMessage {
  signature: string;
  mint: string;
  sol_amount: number;
  token_amount: number;
  is_buy: boolean;
  user: string;
  timestamp: number;
  tx_index: number;
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

class TradeStreamManager {
  private ws: WebSocket | null = null;
  private isConnecting: boolean = false;
  private subscriptions: Set<string> = new Set();
  private callbacks: Map<string, StreamCallbacks> = new Map();
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
          this.callbacks.forEach(callback => {
            if (callback.onConnect) {
              callback.onConnect();
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
          this.callbacks.forEach(callback => {
            if (callback.onError) {
              callback.onError(`WebSocket error: ${error.message}`);
            }
          });

          reject(error); // Reject promise on error
        });

        this.ws.on('close', (code, reason) => {
          console.log(`WebSocket closed: ${code} - ${reason}`);
          this.isConnecting = false;
          this.ws = null;
          
          // Call onDisconnect callbacks
          this.callbacks.forEach(callback => {
            if (callback.onDisconnect) {
              callback.onDisconnect();
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
      this.callbacks.forEach(callback => {
        if (callback.onError) {
          callback.onError('Max reconnection attempts reached');
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

  private handleTradeMessage(message: any): void {
    // Debug: print ALL messages
    console.log('📨 Raw message received:', JSON.stringify(message, null, 2));
    
    // Check if this is a trade message and extract mint address
    if (message && typeof message === 'object') {
      const mintAddress = message.mint;
      
      if (mintAddress) {
        console.log(`🎯 Trade message for mint: ${mintAddress}`);
        
        if (this.callbacks.has(mintAddress)) {
          const callback = this.callbacks.get(mintAddress);
          if (callback?.onTrade) {
            try {
              callback.onTrade(message as TradeMessage);
            } catch (error) {
              console.error('Error in trade callback:', error);
              if (callback.onError) {
                callback.onError(`Trade callback error: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
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

      // Store callbacks and subscription
      this.callbacks.set(mintAddress, callbacks);
      this.subscriptions.add(mintAddress);

      // Connect and wait for connection to be established
      await this.connect();

      return {
        success: true,
        websocket: this.ws || undefined
      };

    } catch (error) {
      console.error('Failed to start trade stream:', error);
      
      // Clean up on failure
      this.callbacks.delete(mintAddress);
      this.subscriptions.delete(mintAddress);
      
      return {
        success: false,
        error: `Failed to start trade stream: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Method to stop streaming for a specific mint (for future use)
  public stopTradeStream(mintAddress: string): void {
    this.callbacks.delete(mintAddress);
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

  // Method to gracefully close all connections
  public async closeAll(): Promise<void> {
    console.log('🔄 Closing all trade streams...');
    
    // Clear all subscriptions and callbacks
    this.subscriptions.clear();
    this.callbacks.clear();
    
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

// Main function that matches your requested signature
export async function start_trades_stream(
  mintAddress: string,
  signers: any, // Will be implemented later
  condition1: any, // Will be implemented later
  condition2: any, // Will be implemented later
  onTrade: (trade: TradeMessage) => void,
  onError?: (error: string) => void,
  onConnect?: () => void,
  onDisconnect?: () => void
): Promise<StreamResult> {
  return tradeStreamManager.startTradeStream(mintAddress, {
    onTrade,
    onError,
    onConnect,
    onDisconnect
  });
}

// Export additional utilities
export { TradeMessage, StreamResult, StreamCallbacks };
export const getConnectionStatus = () => tradeStreamManager.getConnectionStatus();
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
// Example usage:
async function testTradeStream() {
  const result = await start_trades_stream(
    'Axb7pscMUp8XHDiJUfqagBPMqf9wr1VQCc4Bcw61pump', // Popular pump.fun token - change this to an active one
    null, // signers (not used yet)
    null, // condition1 (not used yet)
    null, // condition2 (not used yet)
    (trade) => {
      // Handle timestamp safely
      let timestampStr = 'Unknown';
      try {
        if (trade.timestamp) {
          // Try different timestamp formats
          let timestamp = trade.timestamp;
          if (typeof timestamp === 'string') {
            timestamp = parseInt(timestamp);
          }
          
          // Check if it's in seconds or milliseconds
          const date = timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000);
          timestampStr = date.toISOString();
        }
      } catch (e) {
        timestampStr = `Invalid (${trade.timestamp})`;
      }

      console.log('🔥 New trade:', {
        signature: trade.signature,
        mint: trade.mint,
        solAmount: trade.sol_amount,
        tokenAmount: trade.token_amount,
        isBuy: trade.is_buy ? '🟢 BUY' : '🔴 SELL',
        user: trade.user,
        timestamp: timestampStr,
        rawTimestamp: trade.timestamp // For debugging
      });
    },
    (error) => {
      console.error('❌ Stream error:', error);
    },
    () => {
      console.log('✅ Connected to trade stream');
    },
    () => {
      console.log('❌ Disconnected from trade stream');
    }
  );

  if (result.success) {
    console.log('🚀 Trade stream started successfully');
    console.log('📊 Connection status:', getConnectionStatus());
    console.log('⚠️  Press Ctrl+C to stop gracefully');
    
    // Example: Close programmatically after 30 seconds (remove this in production)
    // setTimeout(async () => {
    //   console.log('⏰ Auto-closing after 30 seconds...');
    //   await closeAllStreams();
    //   process.exit(0);
    // }, 30000);
    
  } else {
    console.error('💥 Failed to start trade stream:', result.error);
  }
}

// Run the test
testTradeStream().catch(console.error);*/