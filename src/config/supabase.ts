// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js'

console.log('Environment check:')
console.log('SUPABASE_URL:', process.env.SUPABASE_URL)
console.log('SUPABASE_PUBLIC:', process.env.SUPABASE_PUBLIC ? 'Found' : 'Missing')

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_PUBLIC!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Add UserContractStatus enum
export enum UserContractStatus {
  InProgress = 0,
  CompletedCondition1 = 1,
  CompletedCondition2 = 2,
  Broken = 3,
}

// Database types based on your schema
export interface User {
  address: string
  created_at: string
  score: number
  username?: string | null
  bio?: string | null
  profile_picture?: string | null
}

export interface Contract {
  id: number
  created_at: string
  condition1: number
  condition2: string
  mint: string
  is_completed: boolean
  completion_reason?: 'market_cap' | 'time_expired' | 'manual' | null
  completed_at?: string | null
}

export interface Payment {
  address: string
  created_at: string
  private: string
  user_address: string
  is_paid: boolean
}

// Updated UserContract interface with status field
export interface UserContract {
  contract_id: number
  user_address: string
  supply: number
  status: UserContractStatus  // Added status field
}

// Extended types for API responses
export interface UserWithContracts extends User {
  activeContracts?: ContractWithDetails[]
  contractHistory?: ContractWithDetails[]
  totalContracts?: number
  successRate?: number
}

export interface ContractWithDetails extends Contract {
  user_supply?: number
  token_symbol?: string
  token_name?: string
  user_status?: UserContractStatus  // Added user status for detailed views
}

// Profile update types
export interface ProfileUpdateData {
  username?: string | null
  bio?: string | null
  profile_picture?: string | null
}

// API response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  count?: number
}

// Contract statistics type
export interface ContractStatistics {
  total: number
  inProgress: number
  completedCondition1: number
  completedCondition2: number
  broken: number
}

// Helper function to get status display name
export function getStatusDisplayName(status: UserContractStatus): string {
  switch (status) {
    case UserContractStatus.InProgress:
      return 'In Progress'
    case UserContractStatus.CompletedCondition1:
      return 'Completed (Market Cap)'
    case UserContractStatus.CompletedCondition2:
      return 'Completed (Time)'
    case UserContractStatus.Broken:
      return 'Failed'
    default:
      return 'Unknown'
  }
}

// Helper function to get status emoji
export function getStatusEmoji(status: UserContractStatus): string {
  switch (status) {
    case UserContractStatus.InProgress:
      return '⏳'
    case UserContractStatus.CompletedCondition1:
      return '🎉'
    case UserContractStatus.CompletedCondition2:
      return '⏰'
    case UserContractStatus.Broken:
      return '💀'
    default:
      return '❓'
  }
}