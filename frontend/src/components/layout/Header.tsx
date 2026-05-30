'use client';

import React, { useEffect, useState } from 'react';
import { getUser, logout } from '@/lib/auth';
import { User } from '@/types';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Hamburger menu button - mobile only */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">
          Manufacturing Dashboard
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role?.name || 'User'}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
