// UserContract Service - src/services/user_contract_service.ts
import { supabase, UserContractStatus } from '../config/supabase'

// Updated UserContract interface with status field
export interface UserContract {
  contract_id: number;
  user_address: string;
  supply: number;
  status: UserContractStatus;
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

  // NEW: Update user contract status
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
    return data
  }

  // NEW: Get user contracts by status
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

  // NEW: Bulk update user contract statuses
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

  // NEW: Get contract statistics
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