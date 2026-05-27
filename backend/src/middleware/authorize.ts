import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/express';

/**
 * Role-Based Access Control middleware.
 * Restricts access to users with specific roles.
 *
 * Usage:
 *   router.post('/qc', authenticate, authorize('QC', 'Admin'), handler);
 */
export function authorize(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Tidak terautentikasi.',
      });
      return;
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: `Akses ditolak. Role '${userRole}' tidak memiliki izin untuk operasi ini.`,
      });
      return;
    }

    next();
  };
}
