import { Response, NextFunction } from 'express';
import { verifyToken } from '../modules/auth/auth.service';
import { AuthenticatedRequest } from '../types/express';

/**
 * JWT Authentication middleware.
 * Extracts token from Authorization header and attaches user to request.
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan. Silakan login.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error('[Auth/Middleware] Token invalid:', error);
    res.status(401).json({
      success: false,
      message: 'Token tidak valid atau sudah expired.',
    });
  }
}
