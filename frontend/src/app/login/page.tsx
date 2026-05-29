'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { AuthResponse } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// Demo credentials for offline/demo mode when backend is unavailable
const DEMO_USERS: Record<string, { password: string; user: AuthResponse }> = {
  sigma: {
    password: 'skibidi',
    user: {
      token: 'demo-token-sigma-admin',
      user: {
        id: 'demo-sigma-id',
        username: 'sigma',
        email: 'sigma@sima.com',
        fullName: 'Sigma Admin',
        isActive: true,
        roleId: 'demo-role-admin',
        role: { id: 'demo-role-admin', name: 'Admin' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  },
};

function demoLogin(username: string, password: string): AuthResponse | null {
  const entry = DEMO_USERS[username];
  if (entry && entry.password === password) {
    return entry.user;
  }
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Try backend first
      const response = await api.post<{ success: boolean; data: AuthResponse; message?: string }>(
        '/auth/login',
        { username: login, password }
      );

      if (response.success && response.data) {
        setAuth(response.data);
        router.push('/dashboard');
        return;
      }

      // Backend returned success:false
      setError(response.message || 'Username atau password salah.');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';

      // Only fallback to demo if backend is unreachable (network error)
      if (message.includes('Tidak dapat terhubung')) {
        const demoResult = demoLogin(login, password);
        if (demoResult) {
          setAuth(demoResult);
          router.push('/dashboard');
          return;
        }
      }

      setError(message || 'Username atau password salah.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🏭 Sima Arome</h1>
          <p className="text-base text-gray-600 mt-2">
            Enterprise Manufacturing Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Login</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="login"
              label="Username atau Email"
              type="text"
              placeholder="Masukkan username atau email"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoFocus
            />

            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
            >
              Masuk
            </Button>
          </form>
        </div>

        {/* Demo credentials hint */}
        <div className="mt-6 p-3 bg-gray-100 border border-gray-200 rounded-lg text-center">
          <p className="text-xs text-gray-500 mb-1">Demo Login</p>
          <p className="text-sm font-mono text-gray-700">
            username: <strong>sigma</strong> / password: <strong>skibidi</strong>
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Sima Arome v1.0 — Hackathon Build
        </p>
      </div>
    </div>
  );
}
