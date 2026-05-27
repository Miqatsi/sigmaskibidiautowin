// ============================================================
// Auth utilities — Token & user management
// ============================================================

import { User, AuthResponse } from '@/types';

export function setAuth(data: AuthResponse): void {
  localStorage.setItem('token', data.token);
  // Backend returns role as string, normalize to object for frontend
  const rawUser = data.user;
  const role = typeof rawUser.role === 'string'
    ? { id: rawUser.roleId || '', name: rawUser.role }
    : rawUser.role;
  const user = { ...rawUser, role };
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
