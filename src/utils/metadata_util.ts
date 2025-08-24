import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';

// Types for metadata structure
export interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: Creator[] | null;
  primarySaleHappened: boolean;
  isMutable: boolean;
  editionNonce: number | null;
  tokenStandard: number | null;
  collection: Collection | null;
  collectionDetails: any | null;
  uses: Uses | null;
  // Off-chain metadata from JSON URI
  offChainMetadata?: OffChainMetadata;
}

export interface Creator {
  address: string;
  verified: boolean;
  share: number;
}

export interface Collection {
  verified: boolean;
  key: string;
}

export interface Uses {
  useMethod: number;
  remaining: number;
  total: number;
}

export interface OffChainMetadata {
  name?: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Attribute[];
  properties?: {
    files?: File[];
    category?: string;
    creators?: OffChainCreator[];
  };
  [key: string]: any; // Allow for additional custom fields
}

export interface Attribute {
  trait_type: string;
  value: string | number;
}

export interface File {
  uri: string;
  type: string;
}

export interface OffChainCreator {
  address: string;
  share: number;
}

export interface MetadataFetchResult {
  success: boolean;
  data?: TokenMetadata;
  error?: string;
}

/**
 * Fetches all available metadata for a given Solana mint address
 * @param mintAddress - The mint address as a string
 * @param rpcUrl - Optional RPC URL (defaults to your Helius endpoint)
 * @param fetchOffChain - Whether to fetch off-chain JSON metadata (default: true)
 * @returns Promise containing the metadata fetch result
 */
export async function fetchMintMetadata(
  mintAddress: string,
  rpcUrl: string = 'https://misty-withered-breeze.solana-mainnet.quiknode.pro/3d44fe946924f708e87bf3d0680b3983620e2278/',
  fetchOffChain: boolean = true
): Promise<MetadataFetchResult> {
  try {
    // Validate mint address
    let mintPublicKey: PublicKey;
    try {
      mintPublicKey = new PublicKey(mintAddress);
    } catch (error) {
      return {
        success: false,
        error: 'Invalid mint address format'
      };
    }

    // Create connection and Metaplex instance
    const connection = new Connection(rpcUrl);
    const metaplex = Metaplex.make(connection);

    // Fetch the NFT/token metadata
    const nft = await metaplex.nfts().findByMint({ mintAddress: mintPublicKey });

    // Extract on-chain metadata
    const metadata: TokenMetadata = {
      mint: mintAddress,
      name: nft.name,
      symbol: nft.symbol,
      uri: nft.uri,
      sellerFeeBasisPoints: nft.sellerFeeBasisPoints,
      creators: nft.creators?.map(creator => ({
        address: creator.address.toString(),
        verified: creator.verified,
        share: creator.share
      })) || null,
      primarySaleHappened: nft.primarySaleHappened,
      isMutable: nft.isMutable,
      editionNonce:  null,
      tokenStandard: nft.tokenStandard || null,
      collection: nft.collection ? {
        verified: nft.collection.verified,
        key: nft.collection.address.toString()
      } : null,
      collectionDetails: nft.collectionDetails || null,
      uses: nft.uses ? {
        useMethod: nft.uses.useMethod,
        remaining: nft.uses.remaining.toNumber(),
        total: nft.uses.total.toNumber()
      } : null
    };

    // Fetch off-chain metadata if requested and URI exists
    if (fetchOffChain && nft.uri && nft.uri.trim() !== '') {
      try {
        const response = await fetch(nft.uri);
        if (response.ok) {
          const offChainData = await response.json();
          metadata.offChainMetadata = offChainData;
        } else {
          console.warn(`Failed to fetch off-chain metadata from ${nft.uri}: ${response.status}`);
        }
      } catch (offChainError) {
        console.warn(`Error fetching off-chain metadata:`, offChainError);
        // Don't fail the entire request if off-chain fetch fails
      }
    }

    return {
      success: true,
      data: metadata
    };

  } catch (error) {
    console.error('Error fetching mint metadata:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // Check for common error types
    if (errorMessage.includes('Account does not exist')) {
      errorMessage = 'Mint address not found or has no metadata';
    } else if (errorMessage.includes('Invalid public key')) {
      errorMessage = 'Invalid mint address format';
    } else if (errorMessage.includes('Network request failed')) {
      errorMessage = 'Network error - check RPC URL and connection';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Fetches only on-chain metadata (faster, no external HTTP requests)
 * @param mintAddress - The mint address as a string
 * @param rpcUrl - Optional RPC URL (defaults to your Helius endpoint)
 * @returns Promise containing the metadata fetch result
 */
export async function fetchOnChainMetadata(
  mintAddress: string,
  rpcUrl: string = 'https://misty-withered-breeze.solana-mainnet.quiknode.pro/3d44fe946924f708e87bf3d0680b3983620e2278/'
): Promise<MetadataFetchResult> {
  return fetchMintMetadata(mintAddress, rpcUrl, false);
}

/**
 * Batch fetch metadata for multiple mint addresses
 * @param mintAddresses - Array of mint addresses
 * @param rpcUrl - Optional RPC URL (defaults to your Helius endpoint)
 * @param fetchOffChain - Whether to fetch off-chain JSON metadata (default: true)
 * @param concurrency - Number of concurrent requests (default: 5)
 * @returns Promise containing array of metadata fetch results
 */
export async function batchFetchMintMetadata(
  mintAddresses: string[],
  rpcUrl: string = 'https://misty-withered-breeze.solana-mainnet.quiknode.pro/3d44fe946924f708e87bf3d0680b3983620e2278/',
  fetchOffChain: boolean = true,
  concurrency: number = 5
): Promise<MetadataFetchResult[]> {
  const results: MetadataFetchResult[] = [];
  
  // Process in batches to avoid overwhelming the RPC
  for (let i = 0; i < mintAddresses.length; i += concurrency) {
    const batch = mintAddresses.slice(i, i + concurrency);
    const batchPromises = batch.map(mintAddress => 
      fetchMintMetadata(mintAddress, rpcUrl, fetchOffChain)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Convert PromiseSettledResult to MetadataFetchResult
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error: `Promise rejected: ${result.reason}`
        });
      }
    }
  }
  
  return results;
}


