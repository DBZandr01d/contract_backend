// src/services/contract_service.ts
import { supabase } from '../config/supabase'
import { StreamManagerService } from './stream_manager_service'
import { TokenService } from './token_service'
import { UserContractService } from './user_contract_service'
import { UserService } from './user_service'

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

// NEW: Interface for signing a contract
interface SignContractParams {
  contractId: number
  userAddress: string
  supply: number
}

interface ContractParticipant {
  user_address: string
  supply: number
  status: number
  user: {
    address: string
    created_at: string
    score: number
    username?: string | null
    bio?: string | null
    profile_picture?: string | null
  }
}

interface ContractWithParticipants {
  id: number
  mint: string
  condition1: number
  condition2: string
  is_completed: boolean
  created_at: string
  completion_reason?: string | null
  completed_at?: string | null
  participants: ContractParticipant[]
  statistics: {
    total: number
    inProgress: number
    completedCondition1: number
    completedCondition2: number
    broken: number
  }
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

  // Get contract with all participants and statistics
  static async getContractWithParticipants(id: number): Promise<ContractWithParticipants | null> {
    console.log(`📊 Getting contract ${id} with all participants...`)
    
    // First get the contract
    const contract = await this.getContractById(id)
    if (!contract) {
      return null
    }

    // Get all user_contracts with user details for this contract
    const { data: userContractsRaw, error: userContractsError } = await supabase
      .from('user_contract')
      .select(`
        user_address,
        supply,
        status,
        user:user_address (
          address,
          created_at,
          score,
          username,
          bio,
          profile_picture
        )
      `)
      .eq('contract_id', id)

    if (userContractsError) {
      console.error('❌ Error fetching user contracts:', userContractsError)
      throw new Error(`Failed to fetch contract participants: ${userContractsError.message}`)
    }

    // Transform the data to match our interface
    const participants: ContractParticipant[] = (userContractsRaw || []).map((item: any) => {
      // Handle the case where user might be an array (Supabase join behavior)
      const userData = Array.isArray(item.user) ? item.user[0] : item.user
      
      return {
        user_address: item.user_address,
        supply: item.supply,
        status: item.status,
        user: {
          address: userData?.address || item.user_address,
          created_at: userData?.created_at || new Date().toISOString(),
          score: userData?.score || 0,
          username: userData?.username || null,
          bio: userData?.bio || null,
          profile_picture: userData?.profile_picture || null
        }
      }
    })

    // Calculate statistics
    const statistics = {
      total: participants.length,
      inProgress: participants.filter(p => p.status === 0).length,
      completedCondition1: participants.filter(p => p.status === 1).length,
      completedCondition2: participants.filter(p => p.status === 2).length,
      broken: participants.filter(p => p.status === 3).length
    }

    console.log(`✅ Found contract ${id} with ${participants.length} participants`)
    console.log(`📊 Statistics:`, statistics)

    return {
      ...contract,
      participants,
      statistics
    }
  }

  // NEW: Sign a contract
  static async signContract(params: SignContractParams) {
    console.log('🔏 Processing contract sign request:', params)

    // 1. Get the contract to validate it exists and get mint address
    const contract = await this.getContractById(params.contractId)
    if (!contract) {
      throw new Error('Contract not found')
    }

    // 2. Check if contract is still active
    if (contract.is_completed) {
      throw new Error('Contract is already completed')
    }

    // 3. Check if contract has expired
    const currentTime = new Date().getTime()
    const expiryTime = new Date(contract.condition2).getTime()
    if (currentTime > expiryTime) {
      throw new Error('Contract has expired')
    }

    // 4. Check if user has already signed this contract
    const existingUserContract = await UserContractService.getUserContract(
      params.contractId, 
      params.userAddress
    )
    
    if (existingUserContract) {
      throw new Error('User has already signed this contract')
    }

    // 5. Ensure user exists in database (using basic methods)
    try {
      let user = await UserService.getUserByAddress(params.userAddress);
      if (!user) {
        console.log('Creating new user:', params.userAddress);
        user = await UserService.createUser({
          address: params.userAddress,
          username: null,
          bio: null,
          profile_picture: null
        });
      }
    } catch (userError) {
      console.warn('User creation/retrieval error:', userError);
      // Continue anyway - user creation is not critical for contract signing
    }

    // 6. Check token balance using TokenService
    console.log('💰 Checking token balance...')
    const balanceResult = await TokenService.checkUserTokenBalance({
      mintAddress: contract.mint,
      userPublicKey: params.userAddress,
      tokenAmount: params.supply
    })

    if (!balanceResult.success) {
      throw new Error(`Failed to verify token balance: ${balanceResult.error}`)
    }

    if (!balanceResult.hasEnoughBalance) {
      throw new Error(`Insufficient token balance. ${balanceResult.error || 'You need more tokens to sign this contract.'}`)
    }

    console.log('✅ Token balance verified')

    // 7. Create user_contract entry
    console.log('📝 Creating user contract entry...')
    const userContract = await UserContractService.createUserContract({
      contract_id: params.contractId,
      user_address: params.userAddress,
      supply: params.supply,
      status: 0 // InProgress
    })

    console.log('✅ Contract signed successfully:', userContract)

    return {
      contract,
      userContract,
      message: 'Contract signed successfully'
    }
  }

  // Create new contract (simple version) - WITH AUTO STREAM START
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
    
    // 🚀 AUTO START STREAM FOR THE NEW CONTRACT
    console.log(`🎬 Auto-starting stream for newly created contract ${data.id}...`)
    
    // Start stream in background (don't wait for it to complete)
    StreamManagerService.startStreamForContract(data.id).then(success => {
      if (success) {
        console.log(`✅ Auto stream startup successful for contract ${data.id}`)
      } else {
        console.log(`⚠️ Auto stream startup failed for contract ${data.id} (will retry automatically)`)
      }
    }).catch(error => {
      console.error(`❌ Auto stream startup error for contract ${data.id}:`, error)
    })

    return data
  }

  // Create contract with user_contract relationship - WITH AUTO STREAM START
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

    // Ensure user exists (using basic methods)
    try {
      let user = await UserService.getUserByAddress(params.userAddress);
      if (!user) {
        console.log('Creating new user:', params.userAddress);
        user = await UserService.createUser({
          address: params.userAddress,
          username: null,
          bio: null,
          profile_picture: null
        });
      }
    } catch (userError) {
      console.warn('User creation/retrieval error:', userError);
      // Continue anyway - user creation is not critical for contract creation
    }

    // Then create the user_contract relationship
    const userContractData = {
      contract_id: contract.id,
      user_address: params.userAddress,
      supply: params.supply,
      status: 0 // InProgress by default
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

    // 🚀 AUTO START STREAM FOR THE NEW CONTRACT (after user_contract is created)
    console.log(`🎬 Auto-starting stream for newly created contract ${contract.id}...`)
    
    // Start stream in background (don't wait for it to complete)
    StreamManagerService.startStreamForContract(contract.id).then(success => {
      if (success) {
        console.log(`✅ Auto stream startup successful for contract ${contract.id}`)
      } else {
        console.log(`⚠️ Auto stream startup failed for contract ${contract.id} (will retry automatically)`)
      }
    }).catch(error => {
      console.error(`❌ Auto stream startup error for contract ${contract.id}:`, error)
    })

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

  // Delete contract - ALSO STOP STREAM
  static async deleteContract(id: number): Promise<void> {
    console.log(`🗑️ Deleting contract ${id}...`)
    
    // Stop stream if active
    if (StreamManagerService.isStreamActive(id)) {
      console.log(`🛑 Stopping active stream for contract ${id} before deletion...`)
      await StreamManagerService.stopStreamForContract(id)
    }

    const { error } = await supabase
      .from('contract')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete contract: ${error.message}`)
    }

    console.log(`✅ Contract ${id} deleted successfully`)
  }

  // Mark contract as completed - ALSO STOP STREAM
  static async markContractCompleted(id: number): Promise<Contract> {
    console.log(`✅ Marking contract ${id} as completed...`)
    
    // Stop stream if active
    if (StreamManagerService.isStreamActive(id)) {
      console.log(`🛑 Stopping active stream for completed contract ${id}...`)
      await StreamManagerService.stopStreamForContract(id)
    }

    const result = await this.updateContract(id, { is_completed: true })
    console.log(`✅ Contract ${id} marked as completed`)
    return result
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