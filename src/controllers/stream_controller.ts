// src/controllers/stream_controller.ts
import { Request, Response } from 'express'
import { StreamManagerService } from '../services/stream_manager_service'

export class StreamController {
  // POST /streams/start/:contractId
  static async startStream(req: Request, res: Response): Promise<void> {
    try {
      const contractId = parseInt(req.params.contractId)
      
      if (isNaN(contractId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      console.log(`🎬 Manual stream start request for contract ${contractId}`)

      // Check if stream is already active
      if (StreamManagerService.isStreamActive(contractId)) {
        res.status(400).json({
          success: false,
          message: `Stream for contract ${contractId} is already active`
        })
        return
      }

      const success = await StreamManagerService.startStreamForContract(contractId)
      
      if (success) {
        res.status(200).json({
          success: true,
          message: `Stream started successfully for contract ${contractId}`,
          data: {
            contractId,
            status: 'started',
            activeStreams: StreamManagerService.getActiveStreams().length
          }
        })
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to start stream for contract ${contractId}`,
          data: {
            contractId,
            status: 'failed'
          }
        })
      }
    } catch (error) {
      console.error('❌ Stream start error:', error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // POST /streams/stop/:contractId
  static async stopStream(req: Request, res: Response): Promise<void> {
    try {
      const contractId = parseInt(req.params.contractId)
      
      if (isNaN(contractId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      console.log(`🛑 Manual stream stop request for contract ${contractId}`)

      // Check if stream is active
      if (!StreamManagerService.isStreamActive(contractId)) {
        res.status(400).json({
          success: false,
          message: `No active stream found for contract ${contractId}`
        })
        return
      }

      const success = await StreamManagerService.stopStreamForContract(contractId)
      
      if (success) {
        res.status(200).json({
          success: true,
          message: `Stream stopped successfully for contract ${contractId}`,
          data: {
            contractId,
            status: 'stopped',
            activeStreams: StreamManagerService.getActiveStreams().length
          }
        })
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to stop stream for contract ${contractId}`,
          data: {
            contractId,
            status: 'failed'
          }
        })
      }
    } catch (error) {
      console.error('❌ Stream stop error:', error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // POST /streams/restart/:contractId
  static async restartStream(req: Request, res: Response): Promise<void> {
    try {
      const contractId = parseInt(req.params.contractId)
      
      if (isNaN(contractId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      console.log(`🔄 Manual stream restart request for contract ${contractId}`)

      const success = await StreamManagerService.restartStreamForContract(contractId)
      
      if (success) {
        res.status(200).json({
          success: true,
          message: `Stream restarted successfully for contract ${contractId}`,
          data: {
            contractId,
            status: 'restarted',
            activeStreams: StreamManagerService.getActiveStreams().length
          }
        })
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to restart stream for contract ${contractId}`,
          data: {
            contractId,
            status: 'failed'
          }
        })
      }
    } catch (error) {
      console.error('❌ Stream restart error:', error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /streams/status/:contractId
  static async getStreamStatus(req: Request, res: Response): Promise<void> {
    try {
      const contractId = parseInt(req.params.contractId)
      
      if (isNaN(contractId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        })
        return
      }

      const isActive = StreamManagerService.isStreamActive(contractId)
      const streamInfo = StreamManagerService.getActiveStream(contractId)
      
      res.status(200).json({
        success: true,
        data: {
          contractId,
          isActive,
          streamInfo: streamInfo || null,
          connectionStatus: StreamManagerService.getStreamConnectionStatus()
        }
      })
    } catch (error) {
      console.error('❌ Stream status error:', error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /streams/active
  static async getActiveStreams(req: Request, res: Response): Promise<void> {
    try {
      const activeStreams = StreamManagerService.getActiveStreams()
      const technicalInfo = StreamManagerService.getStreamTechnicalInfo()
      
      res.status(200).json({
        success: true,
        data: {
          count: activeStreams.length,
          streams: activeStreams,
          connectionStatus: StreamManagerService.getStreamConnectionStatus(),
          technicalInfo
        }
      })
    } catch (error) {
      console.error('❌ Get active streams error:', error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // POST /streams/start-all
  static async startAllStreams(req: Request, res: Response): Promise<void> {
    try {
      console.log('🚀 Manual start all streams request')
      
      await StreamManagerService.startStreamsForAllActiveContracts()
      
      res.status(200).json({
        success: true,
        message: 'Stream startup initiated for all active contracts',
        data: {
          status: 'initiated'
        }
      })
    } catch (error) {
      console.error('❌ Start all streams error:', error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // POST /streams/stop-all
  static async stopAllStreams(req: Request, res: Response): Promise<void> {
    try {
      console.log('🛑 Manual stop all streams request')
      
      const activeCount = StreamManagerService.getActiveStreams().length
      
      await StreamManagerService.stopAllStreams()
      
      res.status(200).json({
        success: true,
        message: `All ${activeCount} streams stopped successfully`,
        data: {
          stoppedCount: activeCount,
          status: 'all_stopped'
        }
      })
    } catch (error) {
      console.error('❌ Stop all streams error:', error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  // GET /streams/health
  static async getStreamHealth(req: Request, res: Response): Promise<void> {
    try {
      const activeStreams = StreamManagerService.getActiveStreams()
      const connectionStatus = StreamManagerService.getStreamConnectionStatus()
      const technicalInfo = StreamManagerService.getStreamTechnicalInfo()
      
      res.status(200).json({
        success: true,
        data: {
          health: 'ok',
          timestamp: new Date().toISOString(),
          activeStreamsCount: activeStreams.length,
          connectionStatus,
          activeStreams,
          technicalInfo
        }
      })
    } catch (error) {
      console.error('❌ Stream health check error:', error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: {
          health: 'error',
          timestamp: new Date().toISOString()
        }
      })
    }
  }
}