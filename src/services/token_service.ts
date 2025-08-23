// src/services/token_service.ts
const { checkTokenBalance } = require('../utils/tokens-util')

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
}

module.exports = { TokenService }