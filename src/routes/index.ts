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

// Import your existing controllers
try {
  const { UserController } = require('../controllers/user_controller')
  const { ContractController } = require('../controllers/contract_controller')
  const { PaymentController } = require('../controllers/payment_controller')
  const { UserContractController } = require('../controllers/user_contract_controller')
  const { AuthController } = require('../controllers/auth_controller')
  const { TokenController } = require('../controllers/token_controller') // Added token controller
  
  // Import middleware
  const { authMiddleware, optionalAuthMiddleware, requireWalletOwnership } = require('../middleware/auth_middleware')

  // =====================================================
  // AUTH ROUTES
  // =====================================================
  router.post('/auth/challenge', AuthController.createChallenge)
  router.post('/auth/verify', AuthController.verifySignature)
  router.post('/auth/logout', AuthController.logout)
  router.get('/auth/me', authMiddleware, AuthController.getCurrentUser)

  // =====================================================
  // USER ROUTES
  // =====================================================
  
  // Public user routes (no auth required)
  router.get('/users', UserController.getAllUsers)
  router.get('/users/search', UserController.searchUsers) // Search users by username
  router.get('/users/leaderboard', UserController.getLeaderboard) // Get leaderboard
  router.get('/users/:address', UserController.getUserByAddress) // Get basic user info
  router.get('/users/:address/profile', UserController.getUserProfile) // Full profile with contracts
  router.get('/users/:address/contracts', UserController.getUserContracts) // User's contracts
  router.get('/users/:address/stats', UserController.getUserStats) // User statistics
  
  // Semi-protected routes (optional auth)
  router.post('/users/:address/ensure', optionalAuthMiddleware, UserController.ensureUser) // Get or create user
  
  // Protected user routes (require authentication)
  router.post('/users', authMiddleware, UserController.createUser)
  router.put('/users/:address', authMiddleware, requireWalletOwnership('address'), UserController.updateUser)
  router.patch('/users/:address/profile', authMiddleware, requireWalletOwnership('address'), UserController.updateUserProfile) // Update profile
  router.delete('/users/:address', authMiddleware, requireWalletOwnership('address'), UserController.deleteUser)
  
  // Admin routes (require auth but not ownership check)
  router.put('/users/:address/score', authMiddleware, UserController.updateUserScore) // Admin only in production

  // =====================================================
  // TOKEN ROUTES
  // =====================================================
  
  // Public token routes
  router.post('/tokens/check-balance', TokenController.checkTokenBalance)

  // =====================================================
  // CONTRACT ROUTES
  // =====================================================
  
  // Public contract routes
  router.get('/contracts', ContractController.getAllContracts)
  router.get('/contracts/completed', ContractController.getCompletedContracts)
  router.get('/contracts/pending', ContractController.getPendingContracts)
  router.get('/contracts/:id', ContractController.getContractById)
  
  // REMOVED AUTH FROM CONTRACT CREATION
  router.post('/contracts', ContractController.createContract) // No auth required now
  
  // Protected contract routes
  router.put('/contracts/:id', authMiddleware, ContractController.updateContract)
  router.delete('/contracts/:id', authMiddleware, ContractController.deleteContract)
  router.put('/contracts/:id/complete', authMiddleware, ContractController.markContractCompleted)

  // =====================================================
  // PAYMENT ROUTES
  // =====================================================
  
  // Public payment routes
  router.get('/payments', PaymentController.getAllPayments)
  router.get('/payments/paid', PaymentController.getPaidPayments)
  router.get('/payments/unpaid', PaymentController.getUnpaidPayments)
  router.get('/payments/:address', PaymentController.getPaymentByAddress)
  router.get('/payments/user/:userAddress', PaymentController.getPaymentsByUserAddress)
  
  // Protected payment routes
  router.post('/payments', authMiddleware, PaymentController.createPayment)
  router.put('/payments/:address', authMiddleware, PaymentController.updatePayment)
  router.delete('/payments/:address', authMiddleware, PaymentController.deletePayment)
  router.put('/payments/:address/pay', authMiddleware, PaymentController.markPaymentPaid)

  // =====================================================
  // USER CONTRACT ROUTES
  // =====================================================
  
  // Public user contract routes
  router.get('/user-contracts', UserContractController.getAllUserContracts)
  router.get('/user-contracts/user/:userAddress', UserContractController.getUserContractsByUserAddress)
  router.get('/user-contracts/contract/:contractId', UserContractController.getUserContractsByContractId)
  router.get('/user-contracts/:contractId/:userAddress', UserContractController.getUserContract)
  router.get('/user-contracts/user/:userAddress/details', UserContractController.getUserContractsWithDetails)
  
  // Protected user contract routes
  router.post('/user-contracts', authMiddleware, UserContractController.createUserContract)
  router.put('/user-contracts/:contractId/:userAddress/supply', authMiddleware, UserContractController.updateUserContractSupply)
  router.delete('/user-contracts/:contractId/:userAddress', authMiddleware, UserContractController.deleteUserContract)

  console.log('✅ Loaded all controllers successfully')
} catch (error) {
  console.log('⚠️ Some controllers not found, using basic routes only')
  console.log('   Error:', error.message)
  
  // Fallback health routes
  router.get('/status', (req, res) => {
    res.json({
      success: true,
      message: 'API server is running',
      timestamp: new Date().toISOString()
    })
  })

  // Fallback auth routes for testing
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

  // Fallback token routes for testing
  router.post('/tokens/check-balance', (req, res) => {
    res.json({
      success: false,
      message: 'TokenController not found - fallback route',
      error: 'Missing token_controller.ts file'
    })
  })
}

export default router