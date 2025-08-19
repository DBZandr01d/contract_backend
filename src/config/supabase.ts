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

export interface UserContract {
  contract_id: number
  user_address: string
  supply: number
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