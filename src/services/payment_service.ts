// src/services/payment_service.ts
import { supabase, Payment } from '../config/supabase'

export class PaymentService {
  // Get all payments
  static async getAllPayments(): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payment')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch payments: ${error.message}`)
    }

    return data || []
  }

  // Get payment by address
  static async getPaymentByAddress(address: string): Promise<Payment | null> {
    const { data, error } = await supabase
      .from('payment')
      .select('*')
      .eq('address', address)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Payment not found
      }
      throw new Error(`Failed to fetch payment: ${error.message}`)
    }

    return data
  }

  // Get payments by user address
  static async getPaymentsByUserAddress(userAddress: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payment')
      .select('*')
      .eq('user_address', userAddress)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch payments for user: ${error.message}`)
    }

    return data || []
  }

  // Create new payment
  static async createPayment(paymentData: Omit<Payment, 'created_at'>): Promise<Payment> {
    const { data, error } = await supabase
      .from('payment')
      .insert([paymentData])
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create payment: ${error.message}`)
    }

    return data
  }

  // Update payment
  static async updatePayment(address: string, updates: Partial<Omit<Payment, 'address' | 'created_at'>>): Promise<Payment> {
    const { data, error } = await supabase
      .from('payment')
      .update(updates)
      .eq('address', address)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update payment: ${error.message}`)
    }

    return data
  }

  // Delete payment
  static async deletePayment(address: string): Promise<void> {
    const { error } = await supabase
      .from('payment')
      .delete()
      .eq('address', address)

    if (error) {
      throw new Error(`Failed to delete payment: ${error.message}`)
    }
  }

  // Mark payment as paid
  static async markPaymentPaid(address: string): Promise<Payment> {
    return this.updatePayment(address, { is_paid: true })
  }

  // Get paid payments
  static async getPaidPayments(): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payment')
      .select('*')
      .eq('is_paid', true)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch paid payments: ${error.message}`)
    }

    return data || []
  }

  // Get unpaid payments
  static async getUnpaidPayments(): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payment')
      .select('*')
      .eq('is_paid', false)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch unpaid payments: ${error.message}`)
    }

    return data || []
  }
}