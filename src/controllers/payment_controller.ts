// src/controllers/payment_controller.ts
import { Request, Response } from 'express'
import { PaymentService } from '../services/payment_service'

export class PaymentController {
  // GET /payments
  static async getAllPayments(req: Request, res: Response): Promise<void> {
    try {
      const payments = await PaymentService.getAllPayments()
      res.status(200).json({
        success: true,
        data: payments,
        count: payments.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /payments/:address
  static async getPaymentByAddress(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      const payment = await PaymentService.getPaymentByAddress(address)
      
      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        })
        return
      }

      res.status(200).json({
        success: true,
        data: payment
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /payments/user/:userAddress
  static async getPaymentsByUserAddress(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress } = req.params
      const payments = await PaymentService.getPaymentsByUserAddress(userAddress)
      
      res.status(200).json({
        success: true,
        data: payments,
        count: payments.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // POST /payments
  static async createPayment(req: Request, res: Response): Promise<void> {
    try {
      const { address, private: privateKey, user_address, is_paid = false } = req.body

      if (!address || !privateKey || !user_address) {
        res.status(400).json({
          success: false,
          message: 'address, private, and user_address are required'
        })
        return
      }

      const payment = await PaymentService.createPayment({
        address,
        private: privateKey,
        user_address,
        is_paid
      })
      
      res.status(201).json({
        success: true,
        data: payment,
        message: 'Payment created successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // PUT /payments/:address
  static async updatePayment(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      const updates = req.body

      const payment = await PaymentService.updatePayment(address, updates)
      
      res.status(200).json({
        success: true,
        data: payment,
        message: 'Payment updated successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // DELETE /payments/:address
  static async deletePayment(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      await PaymentService.deletePayment(address)
      
      res.status(200).json({
        success: true,
        message: 'Payment deleted successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // PUT /payments/:address/pay
  static async markPaymentPaid(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params
      const payment = await PaymentService.markPaymentPaid(address)
      
      res.status(200).json({
        success: true,
        data: payment,
        message: 'Payment marked as paid'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /payments/paid
  static async getPaidPayments(req: Request, res: Response): Promise<void> {
    try {
      const payments = await PaymentService.getPaidPayments()
      res.status(200).json({
        success: true,
        data: payments,
        count: payments.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /payments/unpaid
  static async getUnpaidPayments(req: Request, res: Response): Promise<void> {
    try {
      const payments = await PaymentService.getUnpaidPayments()
      res.status(200).json({
        success: true,
        data: payments,
        count: payments.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }
}