// UserContract Controller - src/controllers/user_contract_controller.ts
import { Request, Response } from 'express'
import { UserContractService } from '../services/user_contract_service'

export class UserContractController {
  // GET /user-contracts
  static async getAllUserContracts(req: Request, res: Response): Promise<void> {
    try {
      const userContracts = await UserContractService.getAllUserContracts()
      res.status(200).json({
        success: true,
        data: userContracts,
        count: userContracts.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /user-contracts/user/:userAddress
  static async getUserContractsByUserAddress(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress } = req.params
      const userContracts = await UserContractService.getUserContractsByUserAddress(userAddress)
      
      res.status(200).json({
        success: true,
        data: userContracts,
        count: userContracts.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /user-contracts/contract/:contractId
  static async getUserContractsByContractId(req: Request, res: Response): Promise<void> {
    try {
      const contractId = parseInt(req.params.contractId)
      
      if (isNaN(contractId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      const userContracts = await UserContractService.getUserContractsByContractId(contractId)
      
      res.status(200).json({
        success: true,
        data: userContracts,
        count: userContracts.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /user-contracts/:contractId/:userAddress
  static async getUserContract(req: Request, res: Response): Promise<void> {
    try {
      const contractId = parseInt(req.params.contractId)
      const { userAddress } = req.params
      
      if (isNaN(contractId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      const userContract = await UserContractService.getUserContract(contractId, userAddress)
      
      if (!userContract) {
        res.status(404).json({
          success: false,
          message: 'User contract not found'
        })
        return
      }

      res.status(200).json({
        success: true,
        data: userContract
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // POST /user-contracts
  static async createUserContract(req: Request, res: Response): Promise<void> {
    try {
      const { contract_id, user_address, supply } = req.body

      if (!contract_id || !user_address || supply === undefined) {
        res.status(400).json({
          success: false,
          message: 'contract_id, user_address, and supply are required'
        })
        return
      }

      const userContract = await UserContractService.createUserContract({
        contract_id,
        user_address,
        supply
      })
      
      res.status(201).json({
        success: true,
        data: userContract,
        message: 'User contract created successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // PUT /user-contracts/:contractId/:userAddress/supply
  static async updateUserContractSupply(req: Request, res: Response): Promise<void> {
    try {
      const contractId = parseInt(req.params.contractId)
      const { userAddress } = req.params
      const { supply } = req.body
      
      if (isNaN(contractId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      if (typeof supply !== 'number') {
        res.status(400).json({
          success: false,
          message: 'Supply must be a number'
        })
        return
      }

      const userContract = await UserContractService.updateUserContractSupply(contractId, userAddress, supply)
      
      res.status(200).json({
        success: true,
        data: userContract,
        message: 'User contract supply updated successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // DELETE /user-contracts/:contractId/:userAddress
  static async deleteUserContract(req: Request, res: Response): Promise<void> {
    try {
      const contractId = parseInt(req.params.contractId)
      const { userAddress } = req.params
      
      if (isNaN(contractId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      await UserContractService.deleteUserContract(contractId, userAddress)
      
      res.status(200).json({
        success: true,
        message: 'User contract deleted successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /user-contracts/user/:userAddress/details
  static async getUserContractsWithDetails(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress } = req.params
      const userContracts = await UserContractService.getUserContractsWithDetails(userAddress)
      
      res.status(200).json({
        success: true,
        data: userContracts,
        count: userContracts.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }
}