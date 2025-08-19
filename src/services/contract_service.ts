// src/services/contract_service.ts
import { supabase, Contract } from '../config/supabase'

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

  // Create new contract
  static async createContract(contractData: Omit<Contract, 'id' | 'created_at'>): Promise<Contract> {
    const { data, error } = await supabase
      .from('contract')
      .insert([contractData])
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create contract: ${error.message}`)
    }

    return data
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