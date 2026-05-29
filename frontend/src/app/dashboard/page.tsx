'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import Link from 'next/link';

interface AISummary {
  totalLots: number;
  pendingQC: number;
  failedQC: number;
  activeOrders: number;
  recentTransactions: number;
  healthScore: number;
}

interface DashboardAlert {
  id: string;
  severity: string;
  title: string;
  type: string;
  link?: string;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [summaryRes, alertsRes] = await Promise.allSettled([
        api.get<{ success: boolean; data: AISummary }>('/ai/summary'),
        api.get<{ success: boolean; data: { alerts: DashboardAlert[] } }>('/alerts'),
      ]);
      if (summaryRes.status === 'fulfilled' && summaryRes.value.success) setSummary(summaryRes.value.data);
      if (alertsRes.status === 'fulfilled' && alertsRes.value.success) setAlerts(alertsRes.value.data.alerts.slice(0, 5));
    } catch {
      setSummary({ totalLots: 0, pendingQC: 0, failedQC: 0, activeOrders: 0, recentTransactions: 0, healthScore: 0 });
    } finally {
      setLoading(false);
    }
  }

  function healthColor(score: number): string {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  }

  function healthBg(score: number): string {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 50) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manufacturing Dashboard</h1>
        <p className="text-base text-gray-600 mt-1">Real-time operational overview</p>
      </div>

      {/* Plant Health Score — Hero Card */}
      <div className={`rounded-xl border-2 p-6 ${summary ? healthBg(summary.healthScore) : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Plant Health Score</p>
            {loading ? (
              <div className="h-12 w-24 bg-gray-200 rounded animate-pulse mt-2" />
            ) : (
              <p className={`text-5xl font-bold mt-1 ${healthColor(summary?.healthScore || 0)}`}>
                {summary?.healthScore ?? 0}<span className="text-2xl text-gray-400">/100</span>
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-6xl opacity-30">🏭</div>
            <Link href="/dashboard/reports">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                📊 Generate Board Report
              </button>
            </Link>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {(summary?.healthScore || 0) >= 80 ? 'All systems operational' :
           (summary?.healthScore || 0) >= 50 ? 'Some issues require attention' :
           'Critical issues detected — immediate action needed'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard icon="📦" label="Total Lots" value={summary?.totalLots} loading={loading} href="/dashboard/lots" />
        <KPICard icon="⏳" label="Pending QC" value={summary?.pendingQC} loading={loading} href="/dashboard/qc" color={summary?.pendingQC ? 'warning' : undefined} />
        <KPICard icon="❌" label="QC Failures" value={summary?.failedQC} loading={loading} href="/dashboard/qc" color={summary?.failedQC ? 'danger' : undefined} />
        <KPICard icon="⚙️" label="Active Orders" value={summary?.activeOrders} loading={loading} href="/dashboard/production" />
        <KPICard icon="📋" label="Inventory Moves" value={summary?.recentTransactions} loading={loading} href="/dashboard/inventory" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="🚀 Quick Actions">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction href="/dashboard/lots" icon="📦" title="Receive Lot" desc="Register incoming materials" />
            <QuickAction href="/dashboard/qc" icon="🔬" title="QC Inspection" desc="Perform quality check" />
            <QuickAction href="/dashboard/recall" icon="🚨" title="Recall Simulator" desc="Simulate contamination impact" />
            <QuickAction href="/dashboard/ai" icon="🤖" title="AI Copilot" desc="Ask manufacturing questions" />
            <QuickAction href="/dashboard/traceability" icon="🔍" title="Trace Lot" desc="Track lot history" />
            <QuickAction href="/dashboard/production" icon="⚙️" title="Production" desc="Manage orders & batches" />
          </div>
        </Card>

        <Card title="⚠️ Live Alerts" action={<Link href="/dashboard/alerts" className="text-sm text-blue-600 hover:underline">View All →</Link>}>
          <div className="space-y-2">
            {alerts.length > 0 ? alerts.map((alert) => (
              <Link key={alert.id} href={alert.link || '/dashboard/alerts'} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <span>{alert.severity === 'CRITICAL' ? '🔴' : alert.severity === 'HIGH' ? '🟠' : alert.severity === 'MEDIUM' ? '🟡' : '🟢'}</span>
                <span className="text-sm text-gray-800 flex-1 truncate">{alert.title}</span>
                <Badge variant={alert.severity === 'HIGH' || alert.severity === 'CRITICAL' ? 'danger' : alert.severity === 'MEDIUM' ? 'warning' : 'success'}>{alert.severity}</Badge>
              </Link>
            )) : (
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">✅ No active alerts</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, loading, href, color }: {
  icon: string; label: string; value?: number; loading: boolean; href: string; color?: 'warning' | 'danger';
}) {
  const borderColor = color === 'danger' ? 'border-red-200 bg-red-50' : color === 'warning' ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-white';
  return (
    <Link href={href}>
      <div className={`rounded-xl border p-4 hover:shadow-md transition-shadow cursor-pointer ${borderColor}`}>
        <div className="flex items-center justify-between">
          <span className="text-xl">{icon}</span>
          {loading && <div className="h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <p className="text-2xl font-bold text-gray-900 mt-2">{loading ? '—' : (value ?? 0)}</p>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
    </Link>
  );
}

function QuickAction({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="font-medium text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </Link>
  );
}

function AlertItem({ level, message }: { level: 'warning' | 'danger'; message: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${level === 'danger' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
      <Badge variant={level}>{level === 'danger' ? 'CRITICAL' : 'WARNING'}</Badge>
      <span className="text-sm text-gray-700">{message}</span>
    </div>
  );
}
