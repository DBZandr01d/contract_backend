// Backend logic for managing keypairs
import { Keypair } from '@solana/web3.js';
import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as dotenv from 'dotenv';

export interface KeypairResponse {
    message: {
      publicKey: string;
      secretKey: Uint8Array; // Include the secretKey for storage
    };
    timestamp: number;
}

const generateNewKeypair = (): Keypair => {
  return Keypair.generate();
};

/**
 * Function to get a keypair
 * Returns the keypair with its public key as a string
 */
export async function getKeypair(): Promise<KeypairResponse> {
  // Generate a new keypair
  const keypair = generateNewKeypair();
  
  // Return the keypair with both publicKey as string and secretKey
  return {
    message: {
      publicKey: keypair.publicKey.toString(), // Convert PublicKey to string
      secretKey: keypair.secretKey // Include the full secretKey
    },
    timestamp: Date.now()
  };
}

export interface BalanceResponse {
  publicKey: string;
  balance?: number;
  success: boolean;
  message?: string;
}

export async function getBalance(publicKeyString: string): Promise<{
  balance: number;
  success: boolean;
  message: string;
}> {
  try {
    // Create a connection to the Solana devnet
    dotenv.config();
    if (!process.env.HELIUS_RPC_URL) {
      throw new Error("Please set HELIUS_RPC_URL in your .env file");
    }

  // Create a connection to the Solana network
    const connection = new Connection(process.env.HELIUS_RPC_URL);
    
    // Convert the public key string to a PublicKey object
    const publicKey = new PublicKey(publicKeyString);
    
    // Fetch the balance in lamports
    const balanceInLamports = await connection.getBalance(publicKey);
    
    // Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
    const balance = balanceInLamports / LAMPORTS_PER_SOL;
    
    return {
      balance,
      success: true,
      message: "Balance check successful"
    };
  } catch (error) {
    return {
      balance: 0,
      success: false,
      message: `Error checking balance: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function createTransferTxn(
  senderKeypair: Keypair, 
  recipientPublicKey: PublicKey, 
  lamports: number, 
  connection: Connection,
  feePayer: PublicKey = senderKeypair.publicKey // Default to recipient as fee payer
): Promise<Transaction> {
  // Add validation and logging
  if (typeof lamports !== 'number' || isNaN(lamports) || lamports <= 0) {
    console.error(`Invalid lamport amount: ${lamports}`);
    throw new Error(`Invalid lamport amount: ${lamports} must be a positive number`);
  }
  
  // Make sure lamports is an integer
  const lamportsInt = Math.floor(lamports);
  
  // Create a transaction instruction
  const transaction = new Transaction().add(
      SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: recipientPublicKey,
          lamports: lamportsInt, // Explicitly use integer value
      })
  );

  // Set a recent blockhash for the transaction
  transaction.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
  
  // Set fee payer to the recipient (owner account)
  transaction.feePayer = feePayer;

  return transaction;
}


// Modified function to execute transactions individually with a recipient keypair for fee payment
async function executeTransactionIndividually(
  transaction: Transaction, 
  connection: Connection, 
  signer: Keypair,
  payerKeypair?: Keypair // Optional payer keypair for fee payment
) {
  try {
    const signers = [signer];
    
    // If a separate fee payer is provided, add it to signers
    if (payerKeypair && !signer.publicKey.equals(payerKeypair.publicKey)) {
      signers.push(payerKeypair);
    }
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      signers,
      {
        commitment: 'confirmed',
        maxRetries: 3
      }
    );
    console.log(`✅ Transaction successful! Signature: ${signature}`);
    return signature;
  } catch (error) {
    console.error(`❌ Transaction failed:`, error);
    return error;
  } 
}
