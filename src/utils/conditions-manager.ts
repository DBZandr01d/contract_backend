import { Connection, PublicKey, ParsedTransactionWithMeta, TokenBalance } from '@solana/web3.js';

interface TokenPriceResult {
  marketCap: number;
  priceInSOL: number;
  source: string;
  timestamp: number | undefined |null;
  signature: string;
}

interface BalanceChange {
  solChange: number;
  tokenChange: number;
}

class TokenPriceFetcher {
  private connection: Connection;
  
  // Program IDs
  private static readonly PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
  private static readonly PUMPSWAP_PROGRAM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
  private static readonly RAYDIUM_PROGRAM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
  
  // Constants
  private static readonly PUMP_TOKEN_SUPPLY = 1_000_000_000; // 1 billion
  private static readonly SOL_DECIMALS = 9;
  private static readonly PUMP_TOKEN_DECIMALS = 6;
  private static readonly MIN_SOL_CHANGE = 1_000_000; // 0.001 SOL in lamports

  constructor(rpcEndpoint: string) {
    this.connection = new Connection(rpcEndpoint, 'confirmed');
  }

  async getTokenMarketCap(tokenMint: string): Promise<TokenPriceResult | null> {
    try {
      const mintPubkey = new PublicKey(tokenMint);
      
      // Get recent transactions for this token
      const signatures = await this.connection.getSignaturesForAddress(
        mintPubkey,
        { limit: 10 } // Reduced for speed
      );

      for (const sig of signatures) {
        try {
          const tx = await this.connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });

          if (tx?.meta) {
            const price = this.extractPriceFromTransaction(tx, tokenMint);
            if (price) {
              return {
                marketCap: price * TokenPriceFetcher.PUMP_TOKEN_SUPPLY,
                priceInSOL: price,
                source: this.detectTradingProgram(tx),
                timestamp: tx.blockTime,
                signature: sig.signature
              };
            }
          }
        } catch (error) {
          // Skip failed transactions and continue
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error fetching price for token ${tokenMint}:`, error);
      return null;
    }
  }

  private extractPriceFromTransaction(
    transaction: ParsedTransactionWithMeta,
    tokenMint: string
  ): number | null {
    if (!transaction.meta) return null;

    const balanceChanges = this.calculateBalanceChanges(transaction.meta, tokenMint);
    
    if (balanceChanges.solChange !== 0 && balanceChanges.tokenChange !== 0) {
      // Calculate price: SOL amount / Token amount
      const solAmount = Math.abs(balanceChanges.solChange) / Math.pow(10, TokenPriceFetcher.SOL_DECIMALS);
      const tokenAmount = Math.abs(balanceChanges.tokenChange) / Math.pow(10, TokenPriceFetcher.PUMP_TOKEN_DECIMALS);
      
      return solAmount / tokenAmount;
    }

    return null;
  }

  private calculateBalanceChanges(meta: any, tokenMint: string): BalanceChange {
    const solChange = this.calculateSOLBalanceChange(meta);
    const tokenChange = this.calculateTokenBalanceChange(meta, tokenMint);
    
    return { solChange, tokenChange };
  }

  private calculateSOLBalanceChange(meta: any): number {
    let totalSOLChange = 0;
    
    if (meta.preBalances && meta.postBalances) {
      for (let i = 0; i < meta.preBalances.length; i++) {
        const change = meta.postBalances[i] - meta.preBalances[i];
        
        // Only count significant SOL changes (exclude small fees)
        if (Math.abs(change) > TokenPriceFetcher.MIN_SOL_CHANGE) {
          totalSOLChange += change;
        }
      }
    }
    
    return totalSOLChange;
  }

  private calculateTokenBalanceChange(meta: any, tokenMint: string): number {
    const preTokenBalances: TokenBalance[] = meta.preTokenBalances || [];
    const postTokenBalances: TokenBalance[] = meta.postTokenBalances || [];
    
    // Create maps for easier lookup
    const preBalanceMap = new Map<number, number>();
    const postBalanceMap = new Map<number, number>();
    
    preTokenBalances.forEach(balance => {
      if (balance.mint === tokenMint) {
        preBalanceMap.set(balance.accountIndex, parseInt(balance.uiTokenAmount.amount));
      }
    });
    
    postTokenBalances.forEach(balance => {
      if (balance.mint === tokenMint) {
        postBalanceMap.set(balance.accountIndex, parseInt(balance.uiTokenAmount.amount));
      }
    });
    
    // Calculate total change
    let totalChange = 0;
    const allAccounts = new Set([...preBalanceMap.keys(), ...postBalanceMap.keys()]);
    
    allAccounts.forEach(accountIndex => {
      const preAmount = preBalanceMap.get(accountIndex) || 0;
      const postAmount = postBalanceMap.get(accountIndex) || 0;
      totalChange += postAmount - preAmount;
    });
    
    return totalChange;
  }

  private detectTradingProgram(transaction: ParsedTransactionWithMeta): string {
    const instructions = transaction.transaction.message.instructions;
    
    for (const instruction of instructions) {
      const programId = instruction.programId.toString();
      
      switch (programId) {
        case TokenPriceFetcher.PUMP_FUN_PROGRAM:
          return "pump.fun bonding curve";
        case TokenPriceFetcher.PUMPSWAP_PROGRAM:
          return "PumpSwap";
        case TokenPriceFetcher.RAYDIUM_PROGRAM:
          return "Raydium";
        default:
          continue;
      }
    }
    
    return "unknown";
  }
}

async function example() {
    const fetcher = new TokenPriceFetcher("https://cosmological-methodical-bush.solana-devnet.quiknode.pro/3679ce59c8a38328d0474927521aaf5bd504649e/");
    const tokenMint = "3zY6JFiumdoJ3ag1GgDtGAqJXdfxxrRSNnsRmXR4pump";
    
    try {
      const result = await fetcher.getTokenMarketCap(tokenMint);
      
      if (result) {
        console.log(`Token: ${tokenMint}`);
        console.log(`Market Cap: ${result.marketCap.toFixed(4)} SOL`);
        console.log(`Price: ${result.priceInSOL.toFixed(10)} SOL per token`);
        console.log(`Trading on: ${result.source}`);
        console.log(`Last trade: ${new Date((result.timestamp || 0) * 1000).toISOString()}`);
        console.log(`Transaction: ${result.signature}`);
      } else {
        console.log("No recent trades found for this token");
      }
    } catch (error) {
      console.error("Error:", error);
    }
}


// Export for use as module
export { TokenPriceFetcher, TokenPriceResult };

// Uncomment to run directly
example();  