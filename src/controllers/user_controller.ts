// src/controllers/user_controller.ts
import { Request, Response } from 'express'
import { UserService } from '../services/user_service'
import { ProfileUpdateData } from '../config/supabase'

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
      
      if (!address) {
        res.status(400).json({
          success: false,
          message: 'Address parameter is required'
        })
        return
      }

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
      const { address, score = 0, username, bio, profile_picture } = req.body

      if (!address) {
        res.status(400).json({
          success: false,
          message: 'Address is required'
        })
        return
      }

      // Check if user already exists
      const existingUser = await UserService.getUserByAddress(address)
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'User already exists'
        })
        return
      }

      const userData: any = { address, score }
      if (username) userData.username = username
      if (bio) userData.bio = bio
      if (profile_picture) userData.profile_picture = profile_picture

      const user = await UserService.createUser(userData)
      
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

      if (!address) {
        res.status(400).json({
          success: false,
          message: 'Address parameter is required'
        })
        return
      }

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
      
      if (!address) {
        res.status(400).json({
          success: false,
          message: 'Address parameter is required'
        })
        return
      }

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

      if (!address) {
        res.status(400).json({
          success: false,
          message: 'Address parameter is required'
        })
        return
      }

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

  // NEW: PATCH /users/:address/profile - Update user profile
  static async updateUserProfile(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      const profileData: ProfileUpdateData = req.body

      if (!address) {
        res.status(400).json({
          success: false,
          message: 'Address parameter is required'
        })
        return
      }

      // Validate input
      if (profileData.username && profileData.username.length > 30) {
        res.status(400).json({
          success: false,
          message: 'Username must be 30 characters or less'
        })
        return
      }

      if (profileData.bio && profileData.bio.length > 200) {
        res.status(400).json({
          success: false,
          message: 'Bio must be 200 characters or less'
        })
        return
      }

      const user = await UserService.updateUserProfile(address, profileData)
      
      res.status(200).json({
        success: true,
        data: user,
        message: 'Profile updated successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // NEW: GET /users/:address/profile - Get full user profile with contracts
  static async getUserProfile(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      
      if (!address) {
        res.status(400).json({
          success: false,
          message: 'Address parameter is required'
        })
        return
      }

      const userProfile = await UserService.getUserWithContracts(address)
      
      if (!userProfile) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        })
        return
      }

      res.status(200).json({
        success: true,
        data: userProfile
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // NEW: GET /users/:address/contracts - Get user's contracts separated by status
  static async getUserContracts(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      
      if (!address) {
        res.status(400).json({
          success: false,
          message: 'Address parameter is required'
        })
        return
      }

      const userProfile = await UserService.getUserWithContracts(address)
      
      if (!userProfile) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        })
        return
      }

      res.status(200).json({
        success: true,
        data: {
          active: userProfile.activeContracts || [],
          history: userProfile.contractHistory || []
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // NEW: POST /users/:address/ensure - Get or create user (for wallet connection)
  static async ensureUser(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      
      if (!address) {
        res.status(400).json({
          success: false,
          message: 'Address parameter is required'
        })
        return
      }

      const user = await UserService.getOrCreateUser(address)
      
      res.status(200).json({
        success: true,
        data: user,
        message: 'User ensured'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // NEW: GET /users/search?q=username - Search users by username
  static async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const { q } = req.query
      
      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Query parameter "q" is required'
        })
        return
      }

      if (q.length < 2) {
        res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters'
        })
        return
      }

      const users = await UserService.searchUsersByUsername(q)
      
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

  // NEW: GET /users/leaderboard - Get top users by score
  static async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20
      
      if (limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Limit cannot exceed 100'
        })
        return
      }

      const users = await UserService.getLeaderboard(limit)
      
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

  // NEW: GET /users/:address/stats - Get user statistics
  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      
      if (!address) {
        res.status(400).json({
          success: false,
          message: 'Address parameter is required'
        })
        return
      }

      const stats = await UserService.getUserStats(address)
      
      res.status(200).json({
        success: true,
        data: stats
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }
}