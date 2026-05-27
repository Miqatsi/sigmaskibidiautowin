import { Request, Response } from 'express';
import { loginUser } from './auth.service';
import { prisma } from '../../lib/prisma';
import { AuthenticatedRequest } from '../../types/express';

/**
 * POST /auth/login
 * Authenticate user and return JWT token.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi.',
      });
      return;
    }

    const result = await loginUser({ username, password });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login gagal.';
    console.error('[Auth/Login] Error:', error);
    res.status(401).json({
      success: false,
      message,
    });
  }
}

/**
 * GET /auth/profile
 * Get current authenticated user's profile.
 */
export async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        isActive: true,
        role: { select: { id: true, name: true } },
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
      return;
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('[Auth/Profile] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
    });
  }
}
