
// UserContract Service - src/services/user_contract_service.ts
import { supabase, UserContract } from '../config/supabase'

export class UserContractService {
  // Get all user contracts
  static async getAllUserContracts(): Promise<UserContract[]> {
    const { data, error } = await supabase
      .from('user_contract')
      .select('*')

    if (error) {
      throw new Error(`Failed to fetch user contracts: ${error.message}`)
    }

    return data || []
  }

  // Get user contracts by user address
  static async getUserContractsByUserAddress(userAddress: string): Promise<UserContract[]> {
    const { data, error } = await supabase
      .from('user_contract')
      .select('*')
      .eq('user_address', userAddress)

    if (error) {
      throw new Error(`Failed to fetch user contracts: ${error.message}`)
    }

    return data || []
  }

  // Get user contracts by contract ID
  static async getUserContractsByContractId(contractId: number): Promise<UserContract[]> {
    const { data, error } = await supabase
      .from('user_contract')
      .select('*')
      .eq('contract_id', contractId)

    if (error) {
      throw new Error(`Failed to fetch user contracts: ${error.message}`)
    }

    return data || []
  }

  // Get specific user contract
  static async getUserContract(contractId: number, userAddress: string): Promise<UserContract | null> {
    const { data, error } = await supabase
      .from('user_contract')
      .select('*')
      .eq('contract_id', contractId)
      .eq('user_address', userAddress)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch user contract: ${error.message}`)
    }

    return data
  }

  // Create user contract
  static async createUserContract(userContractData: UserContract): Promise<UserContract> {
    const { data, error } = await supabase
      .from('user_contract')
      .insert([userContractData])
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create user contract: ${error.message}`)
    }

    return data
  }

  // Update user contract supply
  static async updateUserContractSupply(contractId: number, userAddress: string, supply: number): Promise<UserContract> {
    const { data, error } = await supabase
      .from('user_contract')
      .update({ supply })
      .eq('contract_id', contractId)
      .eq('user_address', userAddress)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update user contract: ${error.message}`)
    }

    return data
  }

  // Delete user contract
  static async deleteUserContract(contractId: number, userAddress: string): Promise<void> {
    const { error } = await supabase
      .from('user_contract')
      .delete()
      .eq('contract_id', contractId)
      .eq('user_address', userAddress)

    if (error) {
      throw new Error(`Failed to delete user contract: ${error.message}`)
    }
  }

  // Get user contracts with related data (joins)
  static async getUserContractsWithDetails(userAddress: string) {
    const { data, error } = await supabase
      .from('user_contract')
      .select(`
        *,
        contract:contract_id(*),
        user:user_address(*)
      `)
      .eq('user_address', userAddress)

    if (error) {
      throw new Error(`Failed to fetch user contracts with details: ${error.message}`)
    }

    return data || []
  }
}