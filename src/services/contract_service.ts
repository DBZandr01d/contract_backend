// src/services/contract_service.ts
import { supabase } from '../config/supabase'

// Updated Contract interface to match correct schema
interface Contract {
  id: number
  mint: string
  condition1: number
  condition2: string
  is_completed: boolean
  created_at: string
}

interface CreateContractParams {
  mint: string
  condition1: number
  condition2: string
  userAddress: string
  supply: number
}

export class ContractService {
  // Get all contracts
  static async getAllContracts(): Promise<Contract[]> {
    const { data, error } = await supabase
      .from('contract')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch contracts: ${error.message}`)
    }

    return data || []
  }

  // Get contract by ID
  static async getContractById(id: number): Promise<Contract | null> {
    const { data, error } = await supabase
      .from('contract')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Contract not found
      }
      throw new Error(`Failed to fetch contract: ${error.message}`)
    }

    return data
  }

  // Create new contract (simple version)
  static async createContract(contractData: Omit<Contract, 'id' | 'created_at'>): Promise<Contract> {
    console.log('💾 Creating contract in database:', contractData)
    
    const { data, error } = await supabase
      .from('contract')
      .insert([contractData])
      .select()
      .single()

    if (error) {
      console.error('❌ Database error:', error)
      throw new Error(`Failed to create contract: ${error.message}`)
    }

    console.log('✅ Contract created successfully:', data)
    return data
  }

  // Create contract with user_contract relationship
  static async createContractWithUserContract(params: CreateContractParams) {
    console.log('💾 Creating contract with user_contract:', params)
    
    // First create the contract
    const contractData = {
      mint: params.mint,
      condition1: params.condition1,
      condition2: params.condition2,
      is_completed: false
    }

    const { data: contract, error: contractError } = await supabase
      .from('contract')
      .insert([contractData])
      .select()
      .single()

    if (contractError) {
      console.error('❌ Contract creation error:', contractError)
      throw new Error(`Failed to create contract: ${contractError.message}`)
    }

    console.log('✅ Contract created:', contract)

    // Then create the user_contract relationship
    const userContractData = {
      contract_id: contract.id,
      user_address: params.userAddress,
      supply: params.supply
    }

    const { data: userContract, error: userContractError } = await supabase
      .from('user_contract')
      .insert([userContractData])
      .select()
      .single()

    if (userContractError) {
      console.error('❌ User contract creation error:', userContractError)
      
      // Clean up: delete the contract if user_contract creation failed
      await supabase.from('contract').delete().eq('id', contract.id)
      
      throw new Error(`Failed to create user contract: ${userContractError.message}`)
    }

    console.log('✅ User contract created:', userContract)

    return {
      contract,
      userContract
    }
  }

  // Update contract
  static async updateContract(id: number, updates: Partial<Omit<Contract, 'id' | 'created_at'>>): Promise<Contract> {
    const { data, error } = await supabase
      .from('contract')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update contract: ${error.message}`)
    }

    return data
  }

  // Delete contract
  static async deleteContract(id: number): Promise<void> {
    const { error } = await supabase
      .from('contract')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete contract: ${error.message}`)
    }
  }

  // Mark contract as completed
  static async markContractCompleted(id: number): Promise<Contract> {
    return this.updateContract(id, { is_completed: true })
  }

  // Get completed contracts
  static async getCompletedContracts(): Promise<Contract[]> {
    const { data, error } = await supabase
      .from('contract')
      .select('*')
      .eq('is_completed', true)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch completed contracts: ${error.message}`)
    }

    return data || []
  }

  // Get pending contracts
  static async getPendingContracts(): Promise<Contract[]> {
    const { data, error } = await supabase
      .from('contract')
      .select('*')
      .eq('is_completed', false)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch pending contracts: ${error.message}`)
    }

    return data || []
  }
}