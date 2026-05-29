'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import ReactFlow, { Background, Controls, Node, Edge, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

interface RecallResult {
  contaminatedLot: { lotNumber: string; supplier: string; material: string; status: string; quantity: number; unit: string };
  impact: { affectedProductionBatches: number; affectedFinishedLots: number; affectedInventoryLocations: number; affectedDispatches: number; totalQuantityAtRisk: number; unit: string };
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  affectedBatches: Array<{ id: string; batchNumber: string; status: string; product: string | null; quantity: number; unit: string }>;
  affectedInventory: Array<{ id: string; type: string; location: string; quantity: number; unit: string; batchNumber: string | null }>;
  affectedCustomers: Array<{ id: string; name: string }>;
  recommendedActions: string[];
}

interface GraphData {
  nodes: Array<{ id: string; type: string; label: string; status?: string; riskLevel?: string }>;
  edges: Array<{ source: string; target: string; label: string }>;
}

function riskColor(level: string): string {
  switch (level) {
    case 'LOW': return 'bg-green-100 text-green-800 border-green-300';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

function nodeColor(type: string): string {
  switch (type) {
    case 'LOT': return '#ef4444';
    case 'BATCH': return '#f59e0b';
    case 'INVENTORY': return '#3b82f6';
    case 'CUSTOMER': return '#8b5cf6';
    default: return '#6b7280';
  }
}

export default function RecallPage() {
  const [lotNumber, setLotNumber] = useState('');
  const [result, setResult] = useState<RecallResult | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lots, setLots] = useState<Array<{ lotNumber: string; material: string; status: string }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    api.get<{ success: boolean; data: Array<{ lotNumber: string; material?: { name: string }; status: string }> }>('/lots?limit=200')
      .then(res => {
        if (res.success && res.data) {
          setLots(res.data.map(l => ({ lotNumber: l.lotNumber, material: l.material?.name || '', status: l.status })));
        }
      }).catch(() => {});
  }, []);

  const filteredLots = lots.filter(l =>
    l.lotNumber.toLowerCase().includes(lotNumber.toLowerCase()) ||
    l.material.toLowerCase().includes(lotNumber.toLowerCase())
  ).slice(0, 10);

  const handleSimulate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotNumber.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setGraphData(null);

    try {
      const [recallRes, graphRes] = await Promise.all([
        api.get<{ success: boolean; data: RecallResult }>(`/traceability/recall/${encodeURIComponent(lotNumber.trim())}`),
        api.get<{ success: boolean; data: GraphData }>(`/traceability/recall/${encodeURIComponent(lotNumber.trim())}/graph`),
      ]);

      if (recallRes.success && recallRes.data) setResult(recallRes.data);
      if (graphRes.success && graphRes.data) setGraphData(graphRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulasi gagal.');
    } finally {
      setLoading(false);
    }
  }, [lotNumber]);

  // Convert graph data to ReactFlow format
  const flowNodes: Node[] = graphData?.nodes.map((n, i) => ({
    id: n.id,
    position: { x: 250, y: i * 150 },
    data: { label: (
      <div className="text-center">
        <div className="text-xs font-bold uppercase" style={{ color: nodeColor(n.type) }}>{n.type}</div>
        <div className="text-sm font-medium mt-1">{n.label}</div>
        {n.status && <div className="text-xs text-gray-500 mt-0.5">{n.status}</div>}
      </div>
    )},
    style: { border: `2px solid ${nodeColor(n.type)}`, borderRadius: '12px', padding: '12px', background: 'white', width: 280 },
  })) || [];

  const flowEdges: Edge[] = graphData?.edges.map((e, i) => ({
    id: `edge-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#6b7280' },
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🚨 Recall Impact Simulator</h1>
        <p className="text-base text-gray-600 mt-1">
          Simulate contamination events — see operational impact instantly
        </p>
      </div>

      {/* Input */}
      <Card>
        <form onSubmit={handleSimulate} className="flex items-end gap-4">
          <div className="flex-1 relative">
            <label htmlFor="lotNumber" className="block text-sm font-medium text-gray-700 mb-1">Contaminated Lot Number</label>
            <input
              id="lotNumber"
              value={lotNumber}
              onChange={(e) => { setLotNumber(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search or select lot number..."
              autoComplete="off"
            />
            {showDropdown && filteredLots.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredLots.map((l) => (
                  <button
                    key={l.lotNumber}
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center justify-between"
                    onMouseDown={() => { setLotNumber(l.lotNumber); setShowDropdown(false); }}
                  >
                    <span className="font-mono text-sm font-medium">{l.lotNumber}</span>
                    <span className="text-xs text-gray-500">{l.material} • {l.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button type="submit" loading={loading} size="md" variant="danger">
            🚨 Simulate Recall
          </Button>
        </form>
        <p className="text-xs text-gray-500 mt-2">This is a read-only simulation. No data will be modified.</p>
      </Card>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      {result && (
        <div className="space-y-6">
          {/* Risk Score Hero */}
          <div className={`rounded-xl border-2 p-6 ${riskColor(result.riskLevel)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide">Risk Assessment</p>
                <p className="text-4xl font-bold mt-1">{result.riskScore}<span className="text-lg opacity-60">/120</span></p>
                <p className="text-lg font-semibold mt-1">{result.riskLevel}</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80">Contaminated Lot</p>
                <p className="text-xl font-mono font-bold">{result.contaminatedLot.lotNumber}</p>
                <p className="text-sm opacity-80 mt-1">{result.contaminatedLot.material}</p>
                <p className="text-sm opacity-80">{result.contaminatedLot.supplier}</p>
              </div>
            </div>
          </div>

          {/* Impact Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ImpactCard label="Production Batches" value={result.impact.affectedProductionBatches} icon="🏭" />
            <ImpactCard label="Finished Products" value={result.impact.affectedFinishedLots} icon="📦" />
            <ImpactCard label="Inventory Locations" value={result.impact.affectedInventoryLocations} icon="🏪" />
            <ImpactCard label="Customers Affected" value={result.impact.affectedDispatches} icon="👥" />
          </div>

          {/* Graph Visualization */}
          {graphData && graphData.nodes.length > 0 && (
            <Card title="📊 Contamination Flow Graph">
              <div style={{ height: '400px' }} className="border border-gray-200 rounded-lg overflow-hidden">
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  fitView
                  attributionPosition="bottom-left"
                >
                  <Background />
                  <Controls />
                </ReactFlow>
              </div>
              <p className="text-xs text-gray-500 mt-2">Interactive graph — zoom, pan, and inspect contamination flow</p>
            </Card>
          )}

          {/* Affected Batches */}
          {result.affectedBatches.length > 0 && (
            <Card title="🏭 Affected Production Batches">
              <div className="space-y-2">
                {result.affectedBatches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-mono font-medium">{b.batchNumber}</span>
                      {b.product && <span className="text-sm text-gray-600 ml-2">→ {b.product}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{b.quantity} {b.unit}</span>
                      <Badge variant={b.status === 'COMPLETED' ? 'success' : b.status === 'IN_PROGRESS' ? 'warning' : 'neutral'}>{b.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Affected Inventory */}
          {result.affectedInventory.length > 0 && (
            <Card title="🏪 Affected Inventory">
              <div className="space-y-2">
                {result.affectedInventory.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{inv.location}</span>
                      <span className="text-sm text-gray-600 ml-2">(Batch: {inv.batchNumber})</span>
                    </div>
                    <Badge variant={inv.type === 'IN' ? 'success' : 'danger'}>{inv.type}: {inv.quantity} {inv.unit}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recommended Actions */}
          <Card title="💡 Recommended Actions">
            <ol className="space-y-2">
              {result.recommendedActions.map((action, i) => (
                <li key={i} className="flex items-start gap-3 p-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm text-gray-700">{action}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}
    </div>
  );
}

function ImpactCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${value > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
      <span className="text-2xl">{icon}</span>
      <p className={`text-3xl font-bold mt-2 ${value > 0 ? 'text-red-700' : 'text-gray-700'}`}>{value}</p>
      <p className="text-xs text-gray-600 mt-1">{label}</p>
    </div>
  );
}
