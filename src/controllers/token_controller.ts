// src/controllers/token_controller.ts
import { Request, Response } from 'express'
const { TokenService } = require('../services/token_service')

class TokenController {
  // POST /tokens/check-balance
  static async checkTokenBalance(req: Request, res: Response): Promise<void> {
    try {
      const { tokenMint, tokenAmount, userAddress } = req.body

      console.log('🔍 Checking token balance:', { tokenMint, tokenAmount, userAddress })

      // Validate required fields
      if (!tokenMint || tokenAmount === undefined || !userAddress) {
        res.status(400).json({
          success: false,
          message: 'tokenMint, tokenAmount, and userAddress are required'
        })
        return
      }

      // Validate tokenAmount is a positive number
      if (typeof tokenAmount !== 'number' || tokenAmount <= 0) {
        res.status(400).json({
          success: false,
          message: 'tokenAmount must be a positive number'
        })
        return
      }

      const result = await TokenService.checkUserTokenBalance({
        mintAddress: tokenMint.trim(),
        userPublicKey: userAddress.trim(),
        tokenAmount: tokenAmount
      })

      console.log('✅ Token balance check result:', result)
      
      if (result.success) {
        if (result.hasEnoughBalance) {
          res.status(200).json({
            success: true,
            hasEnoughBalance: true,
            message: 'Sufficient token balance confirmed'
          })
        } else {
          res.status(400).json({
            success: false,
            hasEnoughBalance: false,
            message: result.error || 'Insufficient token balance',
            actualBalance: result.actualBalance,
            requiredBalance: result.requiredBalance
          })
        }
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Failed to check token balance'
        })
      }
    } catch (error) {
      console.error('❌ Token balance check error:', error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }
}

module.exports = { TokenController }