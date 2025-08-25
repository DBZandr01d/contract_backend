// src/controllers/contract_controller.ts
import { Request, Response } from 'express'
import { ContractService } from '../services/contract_service'

export class ContractController {
  // GET /contracts
  static async getAllContracts(req: Request, res: Response): Promise<void> {
    try {
      const contracts = await ContractService.getAllContracts()
      res.status(200).json({
        success: true,
        data: contracts,
        count: contracts.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /contracts/:id
  static async getContractById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      const contract = await ContractService.getContractById(id)
      
      if (!contract) {
        res.status(404).json({
          success: false,
          message: 'Contract not found'
        })
        return
      }

      res.status(200).json({
        success: true,
        data: contract
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /contracts/:id/participants
  static async getContractWithParticipants(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      const contractWithParticipants = await ContractService.getContractWithParticipants(id)
      
      if (!contractWithParticipants) {
        res.status(404).json({
          success: false,
          message: 'Contract not found'
        })
        return
      }

      res.status(200).json({
        success: true,
        data: contractWithParticipants
      })
    } catch (error) {
      console.error('❌ Error in getContractWithParticipants:', error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // NEW: POST /contracts/:id/sign - Sign a contract
  static async signContract(req: Request, res: Response): Promise<void> {
    try {
      const contractId = parseInt(req.params.id)
      const { supply, userAddress } = req.body

      console.log('🔏 User attempting to sign contract:', { contractId, supply, userAddress })

      // Validate required fields
      if (isNaN(contractId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      if (!supply || !userAddress) {
        res.status(400).json({
          success: false,
          message: 'supply and userAddress are required'
        })
        return
      }

      // Validate supply is a positive number
      if (typeof supply !== 'number' || supply <= 0) {
        res.status(400).json({
          success: false,
          message: 'supply must be a positive number'
        })
        return
      }

      const result = await ContractService.signContract({
        contractId,
        userAddress: userAddress.trim(),
        supply
      })

      console.log('✅ Contract signed successfully:', result)
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Contract signed successfully'
      })
    } catch (error) {
      console.error('❌ Contract signing error:', error)
      
      // Handle specific error messages from the service
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            message: error.message
          })
          return
        }
        
        if (error.message.includes('already signed') || 
            error.message.includes('completed') || 
            error.message.includes('expired') ||
            error.message.includes('Insufficient token balance')) {
          res.status(400).json({
            success: false,
            message: error.message
          })
          return
        }
      }
      
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // POST /contracts - Updated to handle frontend field names
  static async createContract(req: Request, res: Response): Promise<void> {
    try {
      const { tokenMint, tokenAmount, condition1Value, condition2Value, userAddress } = req.body

      console.log('🔥 Received contract data:', { tokenMint, tokenAmount, condition1Value, condition2Value, userAddress })

      // Validate required fields
      if (!tokenMint || tokenAmount === undefined || condition1Value === undefined || !condition2Value || !userAddress) {
        res.status(400).json({
          success: false,
          message: 'tokenMint, tokenAmount, condition1Value, condition2Value, and userAddress are required'
        })
        return
      }

      // Create contract and user_contract in a transaction
      const result = await ContractService.createContractWithUserContract({
        mint: tokenMint.trim(),
        condition1: condition1Value,
        condition2: condition2Value,
        userAddress: userAddress.trim(),
        supply: tokenAmount
      })

      console.log('✅ Contract and user_contract created:', result)
      
      res.status(201).json({
        success: true,
        data: result.contract,
        message: 'Contract created successfully'
      })
    } catch (error) {
      console.error('❌ Contract creation error:', error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // PUT /contracts/:id
  static async updateContract(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      const updates = req.body
      const contract = await ContractService.updateContract(id, updates)
      
      res.status(200).json({
        success: true,
        data: contract,
        message: 'Contract updated successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // DELETE /contracts/:id
  static async deleteContract(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      await ContractService.deleteContract(id)
      
      res.status(200).json({
        success: true,
        message: 'Contract deleted successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // PUT /contracts/:id/complete
  static async markContractCompleted(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      const contract = await ContractService.markContractCompleted(id)
      
      res.status(200).json({
        success: true,
        data: contract,
        message: 'Contract marked as completed'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /contracts/completed
  static async getCompletedContracts(req: Request, res: Response): Promise<void> {
    try {
      const contracts = await ContractService.getCompletedContracts()
      res.status(200).json({
        success: true,
        data: contracts,
        count: contracts.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /contracts/pending
  static async getPendingContracts(req: Request, res: Response): Promise<void> {
    try {
      const contracts = await ContractService.getPendingContracts()
      res.status(200).json({
        success: true,
        data: contracts,
        count: contracts.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }
}