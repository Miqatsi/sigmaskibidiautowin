'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import Link from 'next/link';

interface DashboardStats {
  lots: { total: number; pendingQc: number };
  production: { total: number; inProgress: number };
  qc: { total: number; recentFails: number };
  inventory: { total: number };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      // Load stats from multiple endpoints in parallel
      const [lotsRes, productionRes, qcRes, inventoryRes] = await Promise.allSettled([
        api.get<{ success: boolean; data: unknown[]; pagination?: { total: number } }>('/lots?limit=1'),
        api.get<{ success: boolean; data: unknown[]; pagination?: { total: number } }>('/production/orders?limit=1'),
        api.get<{ success: boolean; data: unknown[]; pagination?: { total: number } }>('/qc?limit=1'),
        api.get<{ success: boolean; data: unknown[]; pagination?: { total: number } }>('/inventory/transactions?limit=1'),
      ]);

      setStats({
        lots: {
          total: lotsRes.status === 'fulfilled' ? (lotsRes.value.pagination?.total ?? 0) : 0,
          pendingQc: 0,
        },
        production: {
          total: productionRes.status === 'fulfilled' ? (productionRes.value.pagination?.total ?? 0) : 0,
          inProgress: 0,
        },
        qc: {
          total: qcRes.status === 'fulfilled' ? (qcRes.value.pagination?.total ?? 0) : 0,
          recentFails: 0,
        },
        inventory: {
          total: inventoryRes.status === 'fulfilled' ? (inventoryRes.value.pagination?.total ?? 0) : 0,
        },
      });
    } catch {
      // Stats are non-critical, show zeros
      setStats({ lots: { total: 0, pendingQc: 0 }, production: { total: 0, inProgress: 0 }, qc: { total: 0, recentFails: 0 }, inventory: { total: 0 } });
    } finally {
      setLoading(false);
    }
  }

  const summaryCards = [
    {
      title: 'Raw Material Lots',
      value: stats?.lots.total ?? '—',
      subtitle: 'Total lots tracked',
      href: '/dashboard/lots',
      color: 'bg-blue-50 border-blue-200',
      icon: '📦',
    },
    {
      title: 'Production Orders',
      value: stats?.production.total ?? '—',
      subtitle: 'Total orders',
      href: '/dashboard/production',
      color: 'bg-purple-50 border-purple-200',
      icon: '🏭',
    },
    {
      title: 'QC Inspections',
      value: stats?.qc.total ?? '—',
      subtitle: 'Total inspections',
      href: '/dashboard/qc',
      color: 'bg-green-50 border-green-200',
      icon: '✅',
    },
    {
      title: 'Inventory Moves',
      value: stats?.inventory.total ?? '—',
      subtitle: 'Total transactions',
      href: '/dashboard/inventory',
      color: 'bg-orange-50 border-orange-200',
      icon: '📋',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-base text-gray-600 mt-1">
          Overview of manufacturing operations
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <div
              className={`rounded-xl border p-5 transition-shadow hover:shadow-md cursor-pointer ${card.color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{card.icon}</span>
                {loading && (
                  <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-3">{card.value}</p>
              <p className="text-base font-medium text-gray-700 mt-1">{card.title}</p>
              <p className="text-sm text-gray-500">{card.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href="/dashboard/lots"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl">📦</span>
            <div>
              <p className="font-medium text-gray-900">Receive Lot</p>
              <p className="text-sm text-gray-500">Register incoming materials</p>
            </div>
          </Link>
          <Link
            href="/dashboard/qc"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl">🔬</span>
            <div>
              <p className="font-medium text-gray-900">QC Inspection</p>
              <p className="text-sm text-gray-500">Perform quality check</p>
            </div>
          </Link>
          <Link
            href="/dashboard/production"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl">⚙️</span>
            <div>
              <p className="font-medium text-gray-900">Start Production</p>
              <p className="text-sm text-gray-500">Create production order</p>
            </div>
          </Link>
          <Link
            href="/dashboard/traceability"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl">🔍</span>
            <div>
              <p className="font-medium text-gray-900">Trace Lot</p>
              <p className="text-sm text-gray-500">Track lot history</p>
            </div>
          </Link>
          <Link
            href="/dashboard/suppliers"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl">🤝</span>
            <div>
              <p className="font-medium text-gray-900">Manage Suppliers</p>
              <p className="text-sm text-gray-500">View & add suppliers</p>
            </div>
          </Link>
          <Link
            href="/dashboard/inventory"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl">🏪</span>
            <div>
              <p className="font-medium text-gray-900">Inventory</p>
              <p className="text-sm text-gray-500">Check stock levels</p>
            </div>
          </Link>
        </div>
      </Card>
    </div>
  );
}
