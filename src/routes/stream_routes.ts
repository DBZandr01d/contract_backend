// src/routes/stream_routes.ts - Example routes file
import { Router } from 'express'
import { StreamController } from '../controllers/stream_controller'

const router = Router()

// Stream management routes

// Manual stream control for specific contracts
router.post('/streams/start/:contractId', StreamController.startStream)
router.post('/streams/stop/:contractId', StreamController.stopStream)  
router.post('/streams/restart/:contractId', StreamController.restartStream)

// Stream status and monitoring
router.get('/streams/status/:contractId', StreamController.getStreamStatus)
router.get('/streams/active', StreamController.getActiveStreams)
router.get('/streams/health', StreamController.getStreamHealth)

// Bulk stream operations
router.post('/streams/start-all', StreamController.startAllStreams)
router.post('/streams/stop-all', StreamController.stopAllStreams)

export default router

/* 
EXAMPLE USAGE:

1. Start stream for contract 123:
   POST /streams/start/123

2. Stop stream for contract 123:  
   POST /streams/stop/123

3. Restart stream for contract 123:
   POST /streams/restart/123

4. Check stream status for contract 123:
   GET /streams/status/123

5. Get all active streams:
   GET /streams/active

6. Get stream health info:
   GET /streams/health

7. Start streams for all pending contracts:
   POST /streams/start-all

8. Stop all active streams:
   POST /streams/stop-all

SAMPLE RESPONSES:

GET /streams/active:
{
  "success": true,
  "data": {
    "count": 2,
    "streams": [
      {
        "contractId": 123,
        "mintAddress": "FAtT2W7mJs27hHRCPiCfrBzASDpFNFQAYz2NXiEhpump",
        "startedAt": "2025-08-24T10:30:00Z",
        "condition1": 50000,
        "condition2": "2025-09-25T18:23:00Z",
        "signersCount": 3
      }
    ],
    "connectionStatus": "connected",
    "technicalInfo": [...]
  }
}

GET /streams/status/123:
{
  "success": true,
  "data": {
    "contractId": 123,
    "isActive": true,
    "streamInfo": {
      "contractId": 123,
      "mintAddress": "FAtT2W7mJs27hHRCPiCfrBzASDpFNFQAYz2NXiEhpump",
      "startedAt": "2025-08-24T10:30:00Z",
      "condition1": 50000,
      "condition2": "2025-09-25T18:23:00Z",
      "signersCount": 3
    },
    "connectionStatus": "connected"
  }
}
*/