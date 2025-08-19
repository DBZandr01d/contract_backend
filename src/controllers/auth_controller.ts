import { Request, Response } from 'express';
import { AuthService, SigninMessage } from '../services/auth_service';

export class AuthController {
  static async createChallenge(req: Request, res: Response): Promise<void> {
    try {
      const { publicKey } = req.body;

      if (!publicKey) {
        res.status(400).json({
          success: false,
          message: 'Public key is required'
        });
        return;
      }

      const domain = req.get('host') || 'localhost';
      const { message, nonce } = AuthService.createChallenge(publicKey, domain);

      res.status(200).json({
        success: true,
        data: { message, nonce }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  static async verifySignature(req: Request, res: Response): Promise<void> {
    try {
      const { message, signature, publicKey } = req.body;

      if (!message || !signature || !publicKey) {
        res.status(400).json({
          success: false,
          message: 'Message, signature, and publicKey are required'
        });
        return;
      }

      const parsedMessage: SigninMessage = typeof message === 'string' 
        ? JSON.parse(message) 
        : message;

      const domain = req.get('host') || 'localhost';
      const result = await AuthService.authenticate(
        parsedMessage,
        signature,
        publicKey,
        domain
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            session: result.session,
            token: result.token
          },
          message: 'Authentication successful'
        });
      } else {
        res.status(401).json({
          success: false,
          message: result.error || 'Authentication failed'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { publicKey } = req.body;
      if (publicKey) {
        await AuthService.revokeSession(publicKey);
      }
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
}