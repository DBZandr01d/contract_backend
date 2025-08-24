// src/services/token_service.ts
const { checkTokenBalance } = require('../utils/tokens-util')
import { fetchMintMetadata } from '../utils/metadata_util'

interface CheckBalanceParams {
  mintAddress: string
  userPublicKey: string
  tokenAmount: number
}

interface TokenBalanceResponse {
  success: boolean
  hasEnoughBalance?: boolean
  error?: string
  actualBalance?: string
  requiredBalance?: string
}

interface TokenMetadataResponse {
  success: boolean
  data?: {
    mint: string
    name: string | null
    image: string | null
  }
  warning?: string
  error?: string
}

export class TokenService {
  /**
   * Check if user has sufficient token balance
   */
  static async checkUserTokenBalance(params: CheckBalanceParams): Promise<TokenBalanceResponse> {
    try {
      console.log('🔍 TokenService checking balance for:', params)
      
      const result = await checkTokenBalance(
        params.mintAddress,
        params.userPublicKey,
        params.tokenAmount
      )

      console.log('📊 Balance check result from utility:', result)

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to check token balance'
        }
      }

      if (result.hasEnoughBalance) {
        return {
          success: true,
          hasEnoughBalance: true
        }
      } else {
        // Create detailed error message with balance information
        let errorMessage = `Insufficient token balance.`
        
        if (result.actualBalance !== undefined && result.requiredBalance !== undefined) {
          errorMessage += ` You have ${result.actualBalance} tokens but need ${result.requiredBalance} tokens.`
        } else {
          errorMessage += ` You need ${params.tokenAmount} tokens to create this contract.`
        }

        return {
          success: true,
          hasEnoughBalance: false,
          error: errorMessage,
          actualBalance: result.actualBalance,
          requiredBalance: result.requiredBalance || params.tokenAmount.toString()
        }
      }

    } catch (error) {
      console.error('❌ TokenService error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while checking balance'
      }
    }
  }

  /**
   * Get token metadata (name and image) for a mint address
   */
  static async getTokenMetadata(mintAddress: string): Promise<TokenMetadataResponse> {
    try {
      console.log('🔍 TokenService fetching metadata for:', mintAddress)
      
      const result = await fetchMintMetadata(mintAddress)

      if (!result.success) {
        console.warn('⚠️ Failed to fetch metadata:', result.error)
        
        // Still return success but with null values and a warning
        // This prevents the frontend from breaking if metadata fails
        return {
          success: true,
          data: {
            mint: mintAddress,
            name: null,
            image: null
          },
          warning: result.error || 'Could not fetch token metadata'
        }
      }

      if (!result.data) {
        return {
          success: true,
          data: {
            mint: mintAddress,
            name: null,
            image: null
          },
          warning: 'No metadata found for this token'
        }
      }

      // Extract name and image from the metadata
      let tokenName: string | null = null
      let tokenImage: string | null = null

      // First try off-chain metadata (usually more complete)
      if (result.data.offChainMetadata) {
        tokenName = result.data.offChainMetadata.name || result.data.name
        tokenImage = result.data.offChainMetadata.image || null
      } else {
        // Fall back to on-chain metadata
        tokenName = result.data.name || null
      }

      console.log('✅ TokenService metadata result:', { 
        mint: mintAddress, 
        name: tokenName, 
        hasImage: !!tokenImage 
      })

      return {
        success: true,
        data: {
          mint: mintAddress,
          name: tokenName,
          image: tokenImage
        }
      }

    } catch (error) {
      console.error('❌ TokenService metadata error:', error)
      
      // Even on error, return success with null values to not break frontend
      return {
        success: true,
        data: {
          mint: mintAddress,
          name: null,
          image: null
        },
        warning: error instanceof Error ? error.message : 'Unknown error occurred while fetching metadata'
      }
    }
  }
}

module.exports = { TokenService }