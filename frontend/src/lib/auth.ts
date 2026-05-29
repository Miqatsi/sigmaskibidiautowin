// ============================================================
// Auth utilities — Token & user management
// ============================================================

import { User, AuthResponse } from '@/types';

export function setAuth(data: AuthResponse): void {
  localStorage.setItem('token', data.token);
  // Backend returns role as string (role name) in login response
  // Normalize to { id, name } object for frontend consistency
  const rawUser = data.user;
  let role: { id: string; name: string };

  if (typeof rawUser.role === 'string') {
    role = { id: '', name: rawUser.role };
  } else if (rawUser.role && typeof rawUser.role === 'object') {
    role = { id: rawUser.role.id || '', name: rawUser.role.name || '' };
  } else {
    role = { id: '', name: 'User' };
  }

  const user: User = {
    id: rawUser.id,
    username: rawUser.username,
    email: rawUser.email,
    fullName: rawUser.fullName,
    isActive: rawUser.isActive ?? true,
    roleId: role.id,
    role,
    createdAt: rawUser.createdAt || new Date().toISOString(),
    updatedAt: rawUser.updatedAt || new Date().toISOString(),
  };

  localStorage.setItem('user', JSON.stringify(user));
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
