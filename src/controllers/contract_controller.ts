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

  // POST /contracts
  static async createContract(req: Request, res: Response): Promise<void> {
    try {
      const { condition1, condition2, mint, is_completed = false } = req.body

      if (condition1 === undefined || !condition2 || !mint) {
        res.status(400).json({
          success: false,
          message: 'condition1, condition2, and mint are required'
        })
        return
      }

      const contract = await ContractService.createContract({
        condition1,
        condition2,
        mint,
        is_completed
      })
      
      res.status(201).json({
        success: true,
        data: contract,
        message: 'Contract created successfully'
      })
    } catch (error) {
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