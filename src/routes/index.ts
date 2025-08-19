import { Router } from 'express'

const router = Router()

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  })
})

// Simple auth routes to test
router.post('/auth/challenge', (req, res) => {
  res.json({
    success: true,
    message: 'Auth challenge endpoint working',
    data: {
      message: 'Test message',
      nonce: 'test-nonce'
    }
  })
})

router.post('/auth/verify', (req, res) => {
  res.json({
    success: true,
    message: 'Auth verify endpoint working',
    data: {
      token: 'test-token',
      session: { publicKey: 'test-key' }
    }
  })
})

// Import your existing controllers if they exist
try {
  const { UserController } = require('../controllers/user_controller')
  const { ContractController } = require('../controllers/contract_controller')
  const { PaymentController } = require('../controllers/payment_controller')
  const { UserContractController } = require('../controllers/user_contract_controller')

  // Add existing routes
  router.get('/users', UserController.getAllUsers)
  router.get('/users/:address', UserController.getUserByAddress)
  router.post('/users', UserController.createUser)
  router.put('/users/:address', UserController.updateUser)
  router.delete('/users/:address', UserController.deleteUser)
  router.put('/users/:address/score', UserController.updateUserScore)

  router.get('/contracts', ContractController.getAllContracts)
  router.get('/contracts/completed', ContractController.getCompletedContracts)
  router.get('/contracts/pending', ContractController.getPendingContracts)
  router.get('/contracts/:id', ContractController.getContractById)
  router.post('/contracts', ContractController.createContract)
  router.put('/contracts/:id', ContractController.updateContract)
  router.delete('/contracts/:id', ContractController.deleteContract)
  router.put('/contracts/:id/complete', ContractController.markContractCompleted)

  router.get('/payments', PaymentController.getAllPayments)
  router.get('/payments/paid', PaymentController.getPaidPayments)
  router.get('/payments/unpaid', PaymentController.getUnpaidPayments)
  router.get('/payments/:address', PaymentController.getPaymentByAddress)
  router.get('/payments/user/:userAddress', PaymentController.getPaymentsByUserAddress)
  router.post('/payments', PaymentController.createPayment)
  router.put('/payments/:address', PaymentController.updatePayment)
  router.delete('/payments/:address', PaymentController.deletePayment)
  router.put('/payments/:address/pay', PaymentController.markPaymentPaid)

  router.get('/user-contracts', UserContractController.getAllUserContracts)
  router.get('/user-contracts/user/:userAddress', UserContractController.getUserContractsByUserAddress)
  router.get('/user-contracts/contract/:contractId', UserContractController.getUserContractsByContractId)
  router.get('/user-contracts/:contractId/:userAddress', UserContractController.getUserContract)
  router.post('/user-contracts', UserContractController.createUserContract)
  router.put('/user-contracts/:contractId/:userAddress/supply', UserContractController.updateUserContractSupply)
  router.delete('/user-contracts/:contractId/:userAddress', UserContractController.deleteUserContract)
  router.get('/user-contracts/user/:userAddress/details', UserContractController.getUserContractsWithDetails)

  console.log('✅ Loaded existing controllers successfully')
} catch (error) {
  console.log('⚠️ Some existing controllers not found, using basic routes only')
  console.log('   Error:', error.message)
}

export default router
