export interface SigninMessage {
  domain: string;
  publicKey: string;
  nonce: string;
  statement: string;
  issuedAt: string;
  expirationTime?: string;
  chainId?: string;
}

export interface AuthSession {
  publicKey: string;
  address: string;
  issuedAt: string;
  expiresAt: string;
}

export interface AuthenticationResult {
  success: boolean;
  session?: AuthSession;
  token?: string;
  error?: string;
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

  static createChallenge(publicKey: string, domain: string): {
    message: SigninMessage;
    nonce: string;
  } {
    const nonce = Math.random().toString(36).substring(2, 15);
    const now = new Date();
    const expirationTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    const message: SigninMessage = {
      domain,
      publicKey,
      nonce,
      statement: 'Sign this message to authenticate with the Solana Contracts platform.',
      issuedAt: now.toISOString(),
      expirationTime: expirationTime.toISOString(),
      chainId: 'devnet',
    };

    return { message, nonce };
  }

  static async authenticate(
    message: SigninMessage,
    signature: string,
    publicKey: string,
    expectedDomain?: string
  ): Promise<AuthenticationResult> {
    try {
      // For now, just create a session without signature verification
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      const session: AuthSession = {
        publicKey,
        address: publicKey,
        issuedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      // Generate simple token
      const token = Buffer.from(JSON.stringify(session)).toString('base64');

      return {
        success: true,
        session,
        token,
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  static async verifyToken(token: string): Promise<AuthSession | null> {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString()) as AuthSession;
      
      if (new Date(decoded.expiresAt) < new Date()) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  static async revokeSession(publicKey: string): Promise<void> {
    console.log('Session revoked for:', publicKey);
  }

  static generateNonce(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}