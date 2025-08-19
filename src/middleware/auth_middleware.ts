import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth_service';

export interface AuthenticatedRequest extends Request {
  user?: {
    publicKey: string;
    address: string;
    issuedAt: string;
    expiresAt: string;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Authorization header required'
      });
      return;
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    const session = await AuthService.verifyToken(token);
    
    if (!session) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
      return;
    }

    req.user = session;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      const session = await AuthService.verifyToken(token);
      if (session) {
        req.user = session;
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

export const requireWalletOwnership = (addressParam: string = 'address') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    const targetAddress = req.params[addressParam];

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!targetAddress) {
      res.status(400).json({
        success: false,
        message: `Address parameter '${addressParam}' is required`
      });
      return;
    }

    if (user.address !== targetAddress) {
      res.status(403).json({
        success: false,
        message: 'You can only access your own resources'
      });
      return;
    }

    next();
  };
};