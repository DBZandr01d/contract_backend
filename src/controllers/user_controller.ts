// src/controllers/user_controller.ts
import { Request, Response } from 'express'
import { UserService } from '../services/user_service'

export class UserController {
  // GET /users
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await UserService.getAllUsers()
      res.status(200).json({
        success: true,
        data: users,
        count: users.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /users/:address
  static async getUserByAddress(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      const user = await UserService.getUserByAddress(address)
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        })
        return
      }

      res.status(200).json({
        success: true,
        data: user
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // POST /users
  static async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { address, score = 0 } = req.body

      if (!address) {
        res.status(400).json({
          success: false,
          message: 'Address is required'
        })
        return
      }

      const user = await UserService.createUser({ address, score })
      
      res.status(201).json({
        success: true,
        data: user,
        message: 'User created successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // PUT /users/:address
  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      const updates = req.body

      const user = await UserService.updateUser(address, updates)
      
      res.status(200).json({
        success: true,
        data: user,
        message: 'User updated successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // DELETE /users/:address
  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      await UserService.deleteUser(address)
      
      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // PUT /users/:address/score
  static async updateUserScore(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      const { score } = req.body

      if (typeof score !== 'number') {
        res.status(400).json({
          success: false,
          message: 'Score must be a number'
        })
        return
      }

      const user = await UserService.updateUserScore(address, score)
      
      res.status(200).json({
        success: true,
        data: user,
        message: 'User score updated successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }
}