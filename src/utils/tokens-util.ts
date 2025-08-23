import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, getMint } from '@solana/spl-token';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables - try multiple paths
if (!process.env.HELIUS_RPC_URL) {
  // Try different paths based on project structure
  const envPaths = [
    '.env',
    '../.env', 
    '../../.env',
    path.join(__dirname, '../../.env'),
    path.join(process.cwd(), '.env')
  ];
  
  for (const envPath of envPaths) {
    try {
      dotenv.config({ path: envPath });
      if (process.env.HELIUS_RPC_URL) break;
    } catch (error) {
      // Continue trying other paths
    }
  }
}

interface TokenBalanceResult {
  success: boolean;
  hasEnoughBalance?: boolean;
  error?: string;
  actualBalance?: string;
  requiredBalance?: string;
}

export async function checkTokenBalance(
  mintAddress: string,
  userPublicKey: string,
  tokenAmount: number
): Promise<TokenBalanceResult> {
  try {
    // Create connection using environment variable
    const rpcUrl = process.env.HELIUS_RPC_URL;
    if (!rpcUrl) {
      return {
        success: false,
        error: 'HELIUS_RPC_URL environment variable is not set'
      };
    }

    const connection = new Connection(rpcUrl, 'confirmed');

    // Convert string parameters to PublicKey objects
    let mintPublicKey: PublicKey;
    let userPubKey: PublicKey;

    try {
      mintPublicKey = new PublicKey(mintAddress);
      userPubKey = new PublicKey(userPublicKey);
    } catch (error) {
      return {
        success: false,
        error: 'Invalid public key format provided'
      };
    }

    // Get mint information to retrieve decimals
    const mintInfo = await getMint(connection, mintPublicKey);
    const decimals = mintInfo.decimals;

    // Get the associated token account address for the user
    const associatedTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      userPubKey
    );

    // Convert required token amount to raw units (multiply by 10^decimals)
    const requiredAmountRaw = BigInt(Math.floor(tokenAmount * Math.pow(10, decimals)));
    const requiredBalanceFormatted = tokenAmount.toString();

    // Get the token account info
    let tokenAccountInfo;
    try {
      tokenAccountInfo = await getAccount(connection, associatedTokenAccount);
    } catch (error) {
      // If account doesn't exist, balance is 0
      const actualBalanceFormatted = "0";
      
      if (tokenAmount <= 0) {
        return {
          success: true,
          hasEnoughBalance: true,
          actualBalance: actualBalanceFormatted,
          requiredBalance: requiredBalanceFormatted
        };
      }
      return {
        success: true,
        hasEnoughBalance: false,
        actualBalance: actualBalanceFormatted,
        requiredBalance: requiredBalanceFormatted
      };
    }

    // Get current balance in raw units
    const currentBalance = tokenAccountInfo.amount;

    // Convert current balance back to human-readable format
    const actualBalanceFormatted = (Number(currentBalance) / Math.pow(10, decimals)).toString();

    // Compare balances
    const hasEnoughBalance = currentBalance >= requiredAmountRaw;

    return {
      success: true,
      hasEnoughBalance,
      actualBalance: actualBalanceFormatted,
      requiredBalance: requiredBalanceFormatted
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to check token balance: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/*
// Example usage:
async function testFunction() {
  const result = await checkTokenBalance(
    'A54Px5Zmy4yaehdZfyi9jkRAn2j7SMyVv8SdRTgwpump', // USDC mint
    'EaSfxPDLHWmBiKNNkXqJ7YWKmHEJfyzcxj3uJxpNwMF', // user wallet
    10000000 // 1.5 USDC
  );
  
  if (result.success) {
    console.log('Has enough balance:', result.hasEnoughBalance);
    console.log('Actual balance:', result.actualBalance);
    console.log('Required balance:', result.requiredBalance);
  } else {
    console.error('Error:', result.error);
  }
}

// Call the test function
testFunction().catch(console.error);
*/

module.exports = { checkTokenBalance }