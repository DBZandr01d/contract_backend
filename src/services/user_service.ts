// src/services/user_service.ts
import { supabase, User } from '../config/supabase'

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
}