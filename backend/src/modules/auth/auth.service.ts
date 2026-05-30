import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface TokenPayload {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string;
  };
}

/**
 * Authenticate user with username/email + password.
 * Returns JWT token and user info on success.
 */
export async function loginUser(payload: LoginPayload): Promise<AuthResult> {
  const { username, password } = payload;

  // Find user by username or email
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
      isActive: true,
      deletedAt: null,
    },
    include: { role: true },
  });

  if (!user) {
    throw new Error('Username atau password salah.');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new Error('Username atau password salah.');
  }

  // Generate JWT
  const tokenPayload: TokenPayload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role.name,
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
    },
  };
}

/**
 * Verify and decode a JWT token.
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
