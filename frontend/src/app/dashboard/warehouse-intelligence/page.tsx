'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface WarehouseZone {
  id: string; name: string; code: string;
  type: 'AMBIENT' | 'COLD_STORAGE' | 'HAZARDOUS' | 'QUARANTINE';
  temperature: { current: number; min: number; max: number; status: string };
  humidity: number;
  capacity: { total: number; used: number; utilization: number };
  riskLevel: string; alerts: string[];
}

interface HealthData {
  score: number; status: string;
  factors: Array<{ name: string; score: number; maxScore: number; status: string }>;
  alerts: Array<{ location: string; currentTemp: number; severity: string; description: string; recommendedAction: string }>;
}

interface SlotRec {
  lotNumber: string; recommendedLocation: string; confidence: number;
  reasoning: string[];
  alternatives: Array<{ location: string; score: number; reason: string }>;
}

interface HazardViolation {
  lotNumber: string; material: string; currentLocation: string;
  hazardClass: string; conflictWith: string; conflictHazardClass: string;
  severity: string; description: string; recommendedAction: string; recommendedLocation: string;
}

function zoneColor(type: string): string {
  switch (type) {
    case 'COLD_STORAGE': return 'bg-blue-100 border-blue-400';
    case 'HAZARDOUS': return 'bg-orange-100 border-orange-400';
    case 'QUARANTINE': return 'bg-red-100 border-red-400';
    default: return 'bg-green-100 border-green-400';
  }
}

function riskBadge(level: string): 'success' | 'warning' | 'danger' {
  return level === 'HIGH' ? 'danger' : level === 'MEDIUM' ? 'warning' : 'success';
}

function tempStatusColor(status: string): string {
  return status === 'CRITICAL' ? 'text-red-600' : status === 'WARNING' ? 'text-yellow-600' : 'text-green-600';
}

export default function WarehouseIntelligencePage() {
  const [zones, setZones] = useState<WarehouseZone[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [slotRec, setSlotRec] = useState<SlotRec | null>(null);
  const [hazardViolations, setHazardViolations] = useState<HazardViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [mapRes, healthRes, hazardRes] = await Promise.all([
        api.get<{ success: boolean; data: WarehouseZone[] }>('/warehouses/intelligence/map'),
        api.get<{ success: boolean; data: HealthData }>('/warehouses/intelligence/health'),
        api.get<{ success: boolean; data: HazardViolation[] }>('/warehouses/intelligence/hazard-violations'),
      ]);
      if (mapRes.success && mapRes.data) setZones(mapRes.data);
      if (healthRes.success && healthRes.data) setHealth(healthRes.data);
      if (hazardRes.success && hazardRes.data) setHazardViolations(hazardRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load warehouse data.');
    } finally {
      setLoading(false);
    }
  }

  async function getSlotRecommendation() {
    try {
      const res = await api.get<{ success: boolean; data: SlotRec }>('/warehouses/intelligence/recommend-slot?lotNumber=RM-2026-NEW');
      if (res.success && res.data) setSlotRec(res.data);
    } catch { /* ignore */ }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏪 Warehouse Intelligence Center</h1>
          <p className="text-base text-gray-600 mt-1">Smart slotting, cold chain monitoring, hazard segregation</p>
        </div>
        <Button size="md" onClick={getSlotRecommendation}>🎯 Recommend Slot</Button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      {/* Health Score */}
      {health && (
        <div className={`rounded-xl border-2 p-5 ${health.score >= 80 ? 'bg-green-50 border-green-300' : health.score >= 60 ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-300'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide">Warehouse Health Score</p>
              <p className={`text-4xl font-bold mt-1 ${health.score >= 80 ? 'text-green-700' : health.score >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                {health.score}<span className="text-xl opacity-50">/100</span>
              </p>
              <p className="font-semibold mt-1">{health.status.replace('_', ' ')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {health.factors.slice(0, 4).map((f) => (
                <div key={f.name} className="text-center bg-white/60 rounded-lg p-2">
                  <p className="text-lg font-bold">{f.score}/{f.maxScore}</p>
                  <p className="text-xs text-gray-600">{f.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cold Chain Alerts */}
      {health && health.alerts.length > 0 && (
        <Card title="🌡️ Cold Chain Alerts">
          <div className="space-y-3">
            {health.alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <Badge variant="danger">{alert.severity}</Badge>
                <div>
                  <p className="text-sm font-medium text-gray-900">{alert.location}: {alert.currentTemp}°C</p>
                  <p className="text-xs text-gray-600">{alert.description}</p>
                  <p className="text-xs text-blue-700 mt-1">💡 {alert.recommendedAction}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Warehouse Floor Map */}
      <Card title="📍 Warehouse Floor Map">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <div key={zone.id} className={`rounded-xl border-2 p-4 ${zoneColor(zone.type)}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold text-gray-900">{zone.name}</p>
                  <p className="text-xs text-gray-600">{zone.code} • {zone.type.replace('_', ' ')}</p>
                </div>
                <Badge variant={riskBadge(zone.riskLevel)}>{zone.riskLevel}</Badge>
              </div>

              {/* Temperature */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm">🌡️</span>
                <span className={`text-sm font-mono font-bold ${tempStatusColor(zone.temperature.status)}`}>
                  {zone.temperature.current}°C
                </span>
                <span className="text-xs text-gray-500">({zone.temperature.min} to {zone.temperature.max}°C)</span>
              </div>

              {/* Capacity Bar */}
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Capacity</span>
                  <span>{zone.capacity.utilization}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${zone.capacity.utilization > 90 ? 'bg-red-500' : zone.capacity.utilization > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${zone.capacity.utilization}%` }}
                  />
                </div>
              </div>

              {/* Humidity */}
              <p className="text-xs text-gray-500 mt-2">💧 Humidity: {zone.humidity}%</p>

              {/* Alerts */}
              {zone.alerts.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  {zone.alerts.map((a, i) => (
                    <p key={i} className="text-xs text-red-600">⚠️ {a}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Hazard Segregation Violations */}
      {hazardViolations.length > 0 && (
        <Card title="⚠️ Hazard Segregation Violations">
          <div className="space-y-3">
            {hazardViolations.slice(0, 5).map((v, i) => (
              <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="danger">{v.severity}</Badge>
                  <span className="text-sm font-medium text-gray-900">{v.lotNumber} — {v.material}</span>
                </div>
                <p className="text-xs text-gray-700">{v.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="text-red-700">❌ {v.hazardClass} vs {v.conflictHazardClass}</span>
                  <span className="text-blue-700">💡 {v.recommendedAction}</span>
                </div>
              </div>
            ))}
          </div>
          {hazardViolations.length > 5 && <p className="text-xs text-gray-500 mt-2">+ {hazardViolations.length - 5} more violations</p>}
        </Card>
      )}

      {/* Smart Slot Recommendation */}
      {slotRec && (
        <Card title="🎯 Smart Slot Recommendation">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Lot: <strong>{slotRec.lotNumber}</strong></p>
              <p className="text-2xl font-bold text-blue-700 mt-2">{slotRec.recommendedLocation}</p>
              <p className="text-sm text-gray-600 mt-1">Confidence: <strong>{slotRec.confidence}%</strong></p>
              <div className="mt-3 space-y-1">
                {slotRec.reasoning.map((r, i) => (
                  <p key={i} className="text-sm text-gray-700">✓ {r}</p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Alternatives:</p>
              <div className="space-y-2">
                {slotRec.alternatives.map((alt, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">{alt.location}</span>
                    <span className="text-xs text-gray-500">Score: {alt.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
