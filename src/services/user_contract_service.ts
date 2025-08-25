// src/services/user_contract_service.ts
// Update: add `signed_at` to local UserContract interface
// References: :contentReference[oaicite:1]{index=1} :contentReference[oaicite:2]{index=2} :contentReference[oaicite:3]{index=3}

import { supabase, UserContractStatus } from '../config/supabase'

// Updated UserContract interface with status field + signed_at (read-only)
export interface UserContract {
  contract_id: number;
  user_address: string;
  supply: number;
  status: UserContractStatus;
  signed_at: string; // ISO timestamp set by DB default CURRENT_TIMESTAMP
}

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

  // Get specific user contract - ENHANCED WITH LOGGING
  static async getUserContract(contractId: number, userAddress: string): Promise<UserContract | null> {
    console.log(`🔍 UserContractService: Looking up user contract for contractId=${contractId}, userAddress=${userAddress}`)
    
    const { data, error } = await supabase
      .from('user_contract')
      .select('*')
      .eq('contract_id', contractId)
      .eq('user_address', userAddress)
      .single()

    if (error) {
      if ((error as any).code === 'PGRST116') {
        console.log(`✅ UserContractService: No existing user contract found for contractId=${contractId}, userAddress=${userAddress}`)
        return null // Not found
      }
      console.error(`❌ UserContractService: Error fetching user contract:`, error)
      throw new Error(`Failed to fetch user contract: ${error.message}`)
    }

    console.log(`🔍 UserContractService: Found existing user contract:`, data)
    return data
  }

  // Create user contract (do NOT send signed_at; DB fills it) - ENHANCED WITH LOGGING
  static async createUserContract(userContractData: Omit<UserContract, 'signed_at'>): Promise<UserContract> {
    console.log(`📝 UserContractService: Creating user contract:`, userContractData)
    
    // Double-check that this combination doesn't already exist
    const existing = await this.getUserContract(userContractData.contract_id, userContractData.user_address)
    if (existing) {
      throw new Error(`User contract already exists: ${JSON.stringify(existing)}`)
    }
    
    const { data, error } = await supabase
      .from('user_contract')
      .insert([userContractData])
      .select()
      .single()

    if (error) {
      console.error(`❌ UserContractService: Failed to create user contract:`, error)
      console.error(`❌ UserContractService: Attempted to insert:`, userContractData)
      
      // Check if it's a duplicate key error
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        // Try to find what's causing the conflict
        const conflicting = await supabase
          .from('user_contract')
          .select('*')
          .eq('contract_id', userContractData.contract_id)
          .eq('user_address', userContractData.user_address)
        
        console.error(`❌ UserContractService: Conflicting records found:`, conflicting.data)
        throw new Error(`Duplicate user contract detected: ${JSON.stringify(conflicting.data)}`)
      }
      
      throw new Error(`Failed to create user contract: ${error.message}`)
    }

    console.log(`✅ UserContractService: User contract created successfully:`, data)
    return data as UserContract
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

    return data as UserContract
  }

  // Update user contract status
  static async updateUserContractStatus(contractId: number, userAddress: string, status: UserContractStatus): Promise<UserContract> {
    console.log(`🔄 UserContractService: Updating status for contract ${contractId}, user ${userAddress} to status ${status}`);
    
    const { data, error } = await supabase
      .from('user_contract')
      .update({ status })
      .eq('contract_id', contractId)
      .eq('user_address', userAddress)
      .select()
      .single()

    if (error) {
      console.error(`❌ UserContractService: Failed to update status:`, error);
      throw new Error(`Failed to update user contract status: ${error.message}`)
    }

    console.log(`✅ UserContractService: Status updated successfully:`, data);
    return data as UserContract
  }

  // Get user contracts by status
  static async getUserContractsByStatus(contractId: number, status: UserContractStatus): Promise<UserContract[]> {
    console.log(`🔍 UserContractService: Getting users with status ${status} for contract ${contractId}`);
    
    const { data, error } = await supabase
      .from('user_contract')
      .select('*')
      .eq('contract_id', contractId)
      .eq('status', status)

    if (error) {
      console.error(`❌ UserContractService: Failed to fetch by status:`, error);
      throw new Error(`Failed to fetch user contracts by status: ${error.message}`)
    }

    console.log(`📊 UserContractService: Found ${data?.length || 0} users with status ${status}`);
    return data || []
  }

  // Bulk update user contract statuses
  static async bulkUpdateUserContractStatuses(contractId: number, fromStatus: UserContractStatus, toStatus: UserContractStatus): Promise<UserContract[]> {
    console.log(`🔄 UserContractService: Bulk updating statuses for contract ${contractId} from ${fromStatus} to ${toStatus}`);
    
    const { data, error } = await supabase
      .from('user_contract')
      .update({ status: toStatus })
      .eq('contract_id', contractId)
      .eq('status', fromStatus)
      .select()

    if (error) {
      console.error(`❌ UserContractService: Failed to bulk update statuses:`, error);
      throw new Error(`Failed to bulk update user contract statuses: ${error.message}`)
    }

    console.log(`✅ UserContractService: Bulk updated ${data?.length || 0} user contracts`);
    return data || []
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

  // Get contract statistics
  static async getContractStatistics(contractId: number) {
    console.log(`📊 UserContractService: Getting statistics for contract ${contractId}`);
    
    const { data, error } = await supabase
      .from('user_contract')
      .select('status')
      .eq('contract_id', contractId)

    if (error) {
      console.error(`❌ UserContractService: Failed to get statistics:`, error);
      throw new Error(`Failed to get contract statistics: ${error.message}`)
    }

    const stats = {
      total: data?.length || 0,
      inProgress: data?.filter(uc => uc.status === UserContractStatus.InProgress).length || 0,
      completedCondition1: data?.filter(uc => uc.status === UserContractStatus.CompletedCondition1).length || 0,
      completedCondition2: data?.filter(uc => uc.status === UserContractStatus.CompletedCondition2).length || 0,
      broken: data?.filter(uc => uc.status === UserContractStatus.Broken).length || 0
    };

    console.log(`📊 UserContractService: Contract ${contractId} statistics:`, stats);
    return stats;
  }
}