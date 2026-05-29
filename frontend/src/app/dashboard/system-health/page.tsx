'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'offline';
  responseTime?: number;
  note?: string;
}

interface HealthData {
  status: string;
  version: string;
  environment: string;
  demoMode: boolean;
  timestamp: string;
  services: Record<string, ServiceStatus>;
}

function statusIcon(status: string): string {
  return status === 'healthy' ? '🟢' : status === 'degraded' ? '🟡' : '🔴';
}

function statusBadge(status: string): 'success' | 'warning' | 'danger' {
  return status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : 'danger';
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string>('');

  useEffect(() => { checkHealth(); }, []);

  async function checkHealth() {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: HealthData }>('/system/health');
      if (res.success && res.data) {
        setHealth(res.data);
        setLastChecked(new Date().toLocaleTimeString('id-ID'));
      }
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  const serviceNames: Record<string, string> = {
    backend: 'Backend API',
    database: 'PostgreSQL Database',
    visualQC: 'AI Visual QC (YOLO)',
    ppicScheduler: 'PPIC Scheduler (OR-Tools)',
    aiCopilot: 'AI Manufacturing Copilot',
    swagger: 'Swagger/OpenAPI Docs',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⚙️ System Health Monitor</h1>
          <p className="text-base text-gray-600 mt-1">Service status and deployment readiness</p>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && <span className="text-xs text-gray-500">Last checked: {lastChecked}</span>}
          <Button size="sm" variant="secondary" onClick={checkHealth} loading={loading}>↻ Refresh</Button>
        </div>
      </div>

      {/* Overall Status */}
      {health && (
        <div className={`rounded-xl border-2 p-5 ${health.status === 'healthy' ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide">System Status</p>
              <p className="text-3xl font-bold mt-1">{statusIcon(health.status)} {health.status.toUpperCase()}</p>
              {health.demoMode && <Badge variant="warning">DEMO MODE</Badge>}
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Version: <strong>{health.version}</strong></p>
              <p>Environment: <strong>{health.environment}</strong></p>
              <p>{new Date(health.timestamp).toLocaleString('id-ID')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Service Grid */}
      <Card title="🔧 Service Status">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-gray-600">Checking services...</span>
          </div>
        ) : health ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(health.services).map(([key, service]) => (
              <div key={key} className={`rounded-lg border p-4 ${service.status === 'healthy' ? 'border-green-200 bg-green-50' : service.status === 'degraded' ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{serviceNames[key] || key}</span>
                  <Badge variant={statusBadge(service.status)}>{service.status}</Badge>
                </div>
                {service.responseTime !== undefined && (
                  <p className="text-xs text-gray-600">Response: {service.responseTime}ms</p>
                )}
                {service.note && (
                  <p className="text-xs text-gray-500 mt-1">{service.note}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-red-600">
            <p className="text-lg font-medium">🔴 Backend Unreachable</p>
            <p className="text-sm mt-1">Cannot connect to backend server. Ensure it is running on port 3000.</p>
          </div>
        )}
      </Card>

      {/* Demo Mode Info */}
      {health?.demoMode && (
        <Card title="ℹ️ Demo Mode Active">
          <p className="text-sm text-gray-700">Some AI services are offline. The platform is using demo/mock responses for:</p>
          <ul className="mt-2 space-y-1">
            {Object.entries(health.services).filter(([, s]) => s.status === 'offline').map(([key]) => (
              <li key={key} className="text-sm text-gray-600">• {serviceNames[key] || key} — using fallback predictions</li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-3">All core features (Copilot, Alerts, Reports, Traceability, Recall) work without external AI services.</p>
        </Card>
      )}
    </div>
  );
}
