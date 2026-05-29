'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface Alert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  severityScore: number;
  title: string;
  description: string;
  recommendedAction: string;
  businessImpact: string;
  link?: string;
  entity?: string;
  createdAt: string;
}

interface AlertSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '🔴';
    case 'HIGH': return '🟠';
    case 'MEDIUM': return '🟡';
    case 'LOW': return '🟢';
    default: return '⚪';
  }
}

function severityBadge(severity: string): 'danger' | 'warning' | 'success' | 'neutral' {
  switch (severity) {
    case 'CRITICAL': case 'HIGH': return 'danger';
    case 'MEDIUM': return 'warning';
    case 'LOW': return 'success';
    default: return 'neutral';
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'QC_FAILURE': return 'QC';
    case 'SUPPLIER_RISK': return 'Supplier';
    case 'EXPIRY': return 'Expiry';
    case 'PRODUCTION_BLOCKER': return 'Production';
    case 'RECALL_EXPOSURE': return 'Recall';
    case 'INVENTORY_HEALTH': return 'Inventory';
    default: return type;
  }
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadAlerts(); }, []);

  async function loadAlerts() {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: { alerts: Alert[]; summary: AlertSummary } }>('/alerts');
      if (res.success && res.data) {
        setAlerts(res.data.alerts);
        setSummary(res.data.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat alerts.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🚨 Operational Alert Center</h1>
          <p className="text-base text-gray-600 mt-1">Proactive risk detection — issues that need your attention</p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadAlerts}>↻ Refresh</Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="Critical" count={summary.critical} color="bg-red-50 border-red-300 text-red-700" icon="🔴" />
          <SummaryCard label="High" count={summary.high} color="bg-orange-50 border-orange-300 text-orange-700" icon="🟠" />
          <SummaryCard label="Medium" count={summary.medium} color="bg-yellow-50 border-yellow-300 text-yellow-700" icon="🟡" />
          <SummaryCard label="Low" count={summary.low} color="bg-green-50 border-green-300 text-green-700" icon="🟢" />
          <SummaryCard label="Total" count={summary.total} color="bg-gray-50 border-gray-300 text-gray-700" icon="📊" />
        </div>
      )}

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      {/* Alert List */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-600">Scanning manufacturing operations...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-lg font-medium text-gray-700">No active alerts</p>
            <p className="text-sm text-gray-500">All manufacturing operations running smoothly</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{severityIcon(alert.severity)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={severityBadge(alert.severity)}>{alert.severity}</Badge>
                      <Badge variant="neutral">{typeLabel(alert.type)}</Badge>
                      <h3 className="font-semibold text-gray-900 text-sm">{alert.title}</h3>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{alert.description}</p>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="text-xs">
                        <span className="font-medium text-blue-700">💡 Action:</span>
                        <span className="text-gray-600 ml-1">{alert.recommendedAction}</span>
                      </div>
                      <div className="text-xs">
                        <span className="font-medium text-orange-700">⚡ Impact:</span>
                        <span className="text-gray-600 ml-1">{alert.businessImpact}</span>
                      </div>
                    </div>
                  </div>
                  {alert.link && (
                    <Link href={alert.link} className="flex-shrink-0">
                      <Button variant="ghost" size="sm">View →</Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({ label, count, color, icon }: { label: string; count: number; color: string; icon: string }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${color}`}>
      <span className="text-lg">{icon}</span>
      <p className="text-2xl font-bold mt-1">{count}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
