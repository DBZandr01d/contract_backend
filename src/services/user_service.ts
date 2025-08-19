// src/services/user_service.ts
import { supabase, User, ProfileUpdateData, UserWithContracts, ContractWithDetails } from '../config/supabase'

export class UserService {
  // Get all users
  static async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('user')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`)
    }

    return data || []
  }

  // Get user by address
  static async getUserByAddress(address: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('user')
      .select('*')
      .eq('address', address)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // User not found
      }
      throw new Error(`Failed to fetch user: ${error.message}`)
    }

    return data
  }

  // Create new user
  static async createUser(userData: Omit<User, 'created_at'>): Promise<User> {
    const { data, error } = await supabase
      .from('user')
      .insert([userData])
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`)
    }

    return data
  }

  // Update user
  static async updateUser(address: string, updates: Partial<Omit<User, 'address' | 'created_at'>>): Promise<User> {
    const { data, error } = await supabase
      .from('user')
      .update(updates)
      .eq('address', address)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`)
    }

    return data
  }

  // Delete user
  static async deleteUser(address: string): Promise<void> {
    const { error } = await supabase
      .from('user')
      .delete()
      .eq('address', address)

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`)
    }
  }

  // Update user score
  static async updateUserScore(address: string, score: number): Promise<User> {
    return this.updateUser(address, { score })
  }

  // NEW: Update user profile (username, bio, profile_picture)
  static async updateUserProfile(address: string, profileData: ProfileUpdateData): Promise<User> {
    // Validate profile data
    if (profileData.username && profileData.username.length > 30) {
      throw new Error('Username must be 30 characters or less')
    }
    
    if (profileData.bio && profileData.bio.length > 200) {
      throw new Error('Bio must be 200 characters or less')
    }

    // Clean empty strings to null
    const cleanData: ProfileUpdateData = {}
    if (profileData.username !== undefined) {
      cleanData.username = profileData.username?.trim() || null
    }
    if (profileData.bio !== undefined) {
      cleanData.bio = profileData.bio?.trim() || null
    }
    if (profileData.profile_picture !== undefined) {
      cleanData.profile_picture = profileData.profile_picture?.trim() || null
    }

    return this.updateUser(address, cleanData)
  }

  // NEW: Get or create user (for auto-creation when wallet connects)
  static async getOrCreateUser(address: string): Promise<User> {
    let user = await this.getUserByAddress(address)
    
    if (!user) {
      // Create new user with default values
      user = await this.createUser({
        address,
        score: 0
      })
    }
    
    return user
  }

  // NEW: Get user with contracts data
  static async getUserWithContracts(address: string): Promise<UserWithContracts | null> {
    const user = await this.getUserByAddress(address)
    if (!user) return null

    try {
      // Get user's contracts with details
      const { data: userContracts, error: contractsError } = await supabase
        .from('user_contract')
        .select(`
          *,
          contract:contract_id(*)
        `)
        .eq('user_address', address)

      if (contractsError) {
        console.error('Error fetching user contracts:', contractsError)
        return user // Return user without contracts if there's an error
      }

      // Separate active and completed contracts
      const activeContracts: ContractWithDetails[] = []
      const contractHistory: ContractWithDetails[] = []

      userContracts?.forEach(uc => {
        if (uc.contract) {
          const contractWithDetails: ContractWithDetails = {
            ...uc.contract,
            user_supply: uc.supply,
            // You can add token metadata here if you have it
            token_symbol: this.getTokenSymbolFromMint(uc.contract.mint),
            token_name: this.getTokenNameFromMint(uc.contract.mint)
          }

          if (uc.contract.is_completed) {
            contractHistory.push(contractWithDetails)
          } else {
            activeContracts.push(contractWithDetails)
          }
        }
      })

      // Sort contracts by date
      activeContracts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      contractHistory.sort((a, b) => {
        const aDate = a.completed_at || a.created_at
        const bDate = b.completed_at || b.created_at
        return new Date(bDate).getTime() - new Date(aDate).getTime()
      })

      // Calculate success rate
      const totalContracts = contractHistory.length
      const successfulContracts = contractHistory.filter(c => c.is_completed && c.completion_reason === 'market_cap').length
      const successRate = totalContracts > 0 ? (successfulContracts / totalContracts) * 100 : 0

      return {
        ...user,
        activeContracts,
        contractHistory,
        totalContracts,
        successRate
      }
    } catch (error) {
      console.error('Error in getUserWithContracts:', error)
      return user // Return user without contracts if there's an error
    }
  }

  // Helper method to get token symbol from mint (you can enhance this)
  private static getTokenSymbolFromMint(mint: string): string | undefined {
    // This is a simple mapping - you can replace with actual token metadata lookup
    const tokenMap: { [key: string]: string } = {
      'So11111111111111111111111111111111111111112': 'SOL',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
      // Add more tokens as needed
    }
    return tokenMap[mint] || mint.slice(0, 4).toUpperCase()
  }

  // Helper method to get token name from mint
  private static getTokenNameFromMint(mint: string): string | undefined {
    const tokenMap: { [key: string]: string } = {
      'So11111111111111111111111111111111111111112': 'Solana',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USD Coin',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'Bonk',
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'Jupiter',
      // Add more tokens as needed
    }
    return tokenMap[mint] || `Token ${mint.slice(0, 8)}`
  }

  // NEW: Search users by username
  static async searchUsersByUsername(query: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('user')
      .select('*')
      .ilike('username', `%${query}%`)
      .order('score', { ascending: false })
      .limit(10)

    if (error) {
      throw new Error(`Failed to search users: ${error.message}`)
    }

    return data || []
  }

  // NEW: Get leaderboard users (top by score)
  static async getLeaderboard(limit: number = 20): Promise<User[]> {
    const { data, error } = await supabase
      .from('user')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch leaderboard: ${error.message}`)
    }

    return data || []
  }

  // NEW: Get user statistics
  static async getUserStats(address: string): Promise<{
    totalContracts: number;
    activeContracts: number;
    completedContracts: number;
    successRate: number;
    rank?: number;
  }> {
    try {
      // Get user's contract count
      const { data: userContracts, error } = await supabase
        .from('user_contract')
        .select(`
          *,
          contract:contract_id(is_completed, completion_reason)
        `)
        .eq('user_address', address)

      if (error) throw error

      const totalContracts = userContracts?.length || 0
      const activeContracts = userContracts?.filter(uc => !uc.contract?.is_completed).length || 0
      const completedContracts = userContracts?.filter(uc => uc.contract?.is_completed).length || 0
      const successfulContracts = userContracts?.filter(uc => 
        uc.contract?.is_completed && uc.contract?.completion_reason === 'market_cap'
      ).length || 0

      const successRate = completedContracts > 0 ? (successfulContracts / completedContracts) * 100 : 0

      // Get user's rank (optional)
      const user = await this.getUserByAddress(address)
      let rank: number | undefined

      if (user) {
        const { data: higherUsers, error: rankError } = await supabase
          .from('user')
          .select('address')
          .gt('score', user.score)

        if (!rankError) {
          rank = (higherUsers?.length || 0) + 1
        }
      }

      return {
        totalContracts,
        activeContracts,
        completedContracts,
        successRate,
        rank
      }
    } catch (error) {
      console.error('Error getting user stats:', error)
      return {
        totalContracts: 0,
        activeContracts: 0,
        completedContracts: 0,
        successRate: 0
      }
    }
  }
}