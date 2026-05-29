'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import ReactFlow, { Background, Controls, Node, Edge, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

// ============================================================
// TYPES
// ============================================================

interface AISummary { totalLots: number; pendingQC: number; failedQC: number; activeOrders: number; healthScore: number }
interface AlertItem { id: string; type: string; severity: string; title: string; description: string; recommendedAction: string; link?: string }
interface AlertsData { alerts: AlertItem[]; summary: { critical: number; high: number; medium: number; low: number; total: number } }

interface CopilotResponse {
  summary: string; confidence: number; riskLevel: string; intent: string;
  dataQuality?: { confidence: string; sampleSize: number };
  evidence?: string[]; recommendations?: string[];
  businessImpact?: { level: string; description: string };
  riskContributors?: Array<{ category: string; score: number; description: string }>;
  metrics?: Record<string, string | number>;
  processingTime?: string;
}

interface RecallData {
  contaminatedLot: { lotNumber: string; supplier: string; material: string };
  impact: { affectedProductionBatches: number; affectedFinishedLots: number; affectedInventoryLocations: number; affectedDispatches: number };
  riskScore: number; riskLevel: string; summary: string;
  affectedBatches: Array<{ batchNumber: string; status: string; product: string | null }>;
  recommendedActions: string[];
}

interface GraphData { nodes: Array<{ id: string; type: string; label: string; status?: string }>; edges: Array<{ source: string; target: string; label: string }> }

interface ReportData {
  overview: string; plantHealthScore: number; operationalStatus: string;
  metrics: Record<string, number>; risks: Array<{ severity: string; description: string; category: string }>;
  recommendations: Array<{ priority: number; action: string; reason: string }>;
}

type AnalysisMode = 'idle' | 'copilot' | 'recall' | 'report';

// ============================================================
// COMPONENT
// ============================================================

export default function IntelligenceCenterPage() {
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertSummary, setAlertSummary] = useState<AlertsData['summary'] | null>(null);

  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>('idle');
  const [copilotResult, setCopilotResult] = useState<CopilotResponse | null>(null);
  const [recallResult, setRecallResult] = useState<RecallData | null>(null);
  const [recallGraph, setRecallGraph] = useState<GraphData | null>(null);
  const [reportResult, setReportResult] = useState<ReportData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { loadOverview(); }, []);

  async function loadOverview() {
    try {
      const [sumRes, alertRes] = await Promise.allSettled([
        api.get<{ success: boolean; data: AISummary }>('/ai/summary'),
        api.get<{ success: boolean; data: AlertsData }>('/alerts'),
      ]);
      if (sumRes.status === 'fulfilled' && sumRes.value.success) setSummary(sumRes.value.data);
      if (alertRes.status === 'fulfilled' && alertRes.value.success) {
        setAlerts(alertRes.value.data.alerts.slice(0, 5));
        setAlertSummary(alertRes.value.data.summary);
      }
    } catch { /* non-critical */ }
  }

  const handleAsk = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    await runAnalysis(question);
  }, [question]);

  async function runAnalysis(q: string) {
    setLoading(true);
    setError('');
    setCopilotResult(null);
    setRecallResult(null);
    setRecallGraph(null);
    setReportResult(null);

    const lower = q.toLowerCase();

    try {
      if (lower.includes('report') || lower.includes('executive') || lower.includes('board')) {
        setMode('report');
        const res = await api.post<{ success: boolean; data: ReportData }>('/ai/report', { reportType: 'executive' });
        if (res.success && res.data) setReportResult(res.data);
      } else {
        const lotMatch = q.match(/\b([A-Z]{2,}-[\w-]+)\b/i);
        if (lotMatch && (lower.includes('contaminated') || lower.includes('recall') || lower.includes('affected') || lower.includes('what happens'))) {
          setMode('recall');
          const lotNumber = lotMatch[1];
          const [recallRes, graphRes] = await Promise.all([
            api.get<{ success: boolean; data: RecallData }>(`/traceability/recall/${encodeURIComponent(lotNumber)}`),
            api.get<{ success: boolean; data: GraphData }>(`/traceability/recall/${encodeURIComponent(lotNumber)}/graph`),
          ]);
          if (recallRes.success && recallRes.data) setRecallResult(recallRes.data);
          if (graphRes.success && graphRes.data) setRecallGraph(graphRes.data);
        } else {
          setMode('copilot');
          const res = await api.post<{ success: boolean; data: CopilotResponse }>('/ai/copilot', { question: q });
          if (res.success && res.data) setCopilotResult(res.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  // ReactFlow
  const flowNodes: Node[] = recallGraph?.nodes.map((n, i) => ({
    id: n.id, position: { x: 250, y: i * 130 },
    data: { label: <div className="text-center"><div className="text-xs font-bold uppercase" style={{ color: n.type === 'LOT' ? '#ef4444' : n.type === 'BATCH' ? '#f59e0b' : '#3b82f6' }}>{n.type}</div><div className="text-xs font-medium mt-1">{n.label}</div></div> },
    style: { border: `2px solid ${n.type === 'LOT' ? '#ef4444' : n.type === 'BATCH' ? '#f59e0b' : '#3b82f6'}`, borderRadius: '10px', padding: '8px', background: 'white', width: 240 },
  })) || [];
  const flowEdges: Edge[] = recallGraph?.edges.map((e, i) => ({ id: `e-${i}`, source: e.source, target: e.target, label: e.label, animated: true, markerEnd: { type: MarkerType.ArrowClosed } })) || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🧠 Manufacturing Intelligence Center</h1>
        <p className="text-sm text-gray-600 mt-1">Command center — plant status, AI analysis, alerts, reports</p>
      </div>

      {/* SECTION 1: Executive Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <OverviewCard label="Plant Health" value={summary ? `${summary.healthScore}` : '—'} unit="/100" color={summary && summary.healthScore >= 80 ? 'green' : summary && summary.healthScore >= 50 ? 'yellow' : 'red'} />
        <OverviewCard label="Critical Alerts" value={alertSummary ? `${alertSummary.critical + alertSummary.high}` : '—'} color={alertSummary && (alertSummary.critical + alertSummary.high) > 0 ? 'red' : 'green'} />
        <OverviewCard label="QC Failures" value={summary?.failedQC?.toString() || '—'} color={summary && summary.failedQC > 0 ? 'red' : 'green'} />
        <OverviewCard label="Pending QC" value={summary?.pendingQC?.toString() || '—'} color={summary && summary.pendingQC > 0 ? 'yellow' : 'green'} />
        <OverviewCard label="Active Orders" value={summary?.activeOrders?.toString() || '—'} color="blue" />
      </div>

      {/* SECTION 3: Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <button onClick={() => { setQuestion('Generate executive report'); runAnalysis('Generate executive report'); }} className="p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors text-center">
          <span className="text-lg">📊</span><p className="text-xs font-medium mt-1">Generate Report</p>
        </button>
        <button onClick={() => { setQuestion('Which supplier has the highest failure rate?'); runAnalysis('Which supplier has the highest failure rate?'); }} className="p-3 rounded-lg border border-gray-200 hover:bg-orange-50 hover:border-orange-300 transition-colors text-center">
          <span className="text-lg">⚠️</span><p className="text-xs font-medium mt-1">Supplier Risk</p>
        </button>
        <button onClick={() => { setQuestion('What happens if RM-2026-001 is contaminated?'); runAnalysis('What happens if RM-2026-001 is contaminated?'); }} className="p-3 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-300 transition-colors text-center">
          <span className="text-lg">🚨</span><p className="text-xs font-medium mt-1">Recall Simulation</p>
        </button>
        <Link href="/dashboard/traceability" className="p-3 rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-300 transition-colors text-center">
          <span className="text-lg">🔍</span><p className="text-xs font-medium mt-1">Traceability</p>
        </Link>
        <Link href="/dashboard/warehouse-intelligence" className="p-3 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-300 transition-colors text-center">
          <span className="text-lg">🏪</span><p className="text-xs font-medium mt-1">Warehouse</p>
        </Link>
      </div>

      {/* SECTION 2: AI Assistant */}
      <Card>
        <form onSubmit={handleAsk} className="space-y-3">
          <label htmlFor="ai-input" className="block text-sm font-medium text-gray-700">🤖 AI Manufacturing Assistant</label>
          <div className="flex gap-2">
            <input
              id="ai-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="flex-1 px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ask about suppliers, lots, QC, production, inventory, recalls..."
            />
            <Button type="submit" loading={loading} size="md">Analyze</Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['Why is PT Bahan Murah Jaya risky?', 'What happens if RM-2026-001 is contaminated?', 'Generate executive report', 'Which production orders are blocked?', 'What are the top risks today?'].map((q) => (
              <button key={q} type="button" onClick={() => { setQuestion(q); runAnalysis(q); }} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700">{q}</button>
            ))}
          </div>
        </form>
      </Card>

      {/* SECTION 4: Alerts */}
      {alerts.length > 0 && (
        <Card title="🚨 Operational Alerts" action={<Link href="/dashboard/alerts" className="text-xs text-blue-600 hover:underline">View All →</Link>}>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => { setQuestion(alert.title); runAnalysis(alert.title); }}>
                <span className="text-sm">{alert.severity === 'CRITICAL' ? '🔴' : alert.severity === 'HIGH' ? '🟠' : '🟡'}</span>
                <span className="text-xs text-gray-800 flex-1 truncate">{alert.title}</span>
                <Badge variant={alert.severity === 'HIGH' || alert.severity === 'CRITICAL' ? 'danger' : 'warning'}>{alert.severity}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {loading && (
        <Card><div className="flex items-center justify-center py-6"><div className="h-6 w-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /><span className="ml-3 text-sm text-gray-600">Analyzing...</span></div></Card>
      )}

      {/* DYNAMIC RESULTS */}

      {/* COPILOT */}
      {mode === 'copilot' && copilotResult && (
        <div className="space-y-3">
          <Card title={`📋 ${copilotResult.intent.replace(/_/g, ' ')}`}>
            <div className="flex items-start gap-2 mb-3">
              <Badge variant={copilotResult.riskLevel === 'HIGH' || copilotResult.riskLevel === 'CRITICAL' ? 'danger' : copilotResult.riskLevel === 'MEDIUM' ? 'warning' : 'success'}>{copilotResult.riskLevel}</Badge>
              <p className="text-sm text-gray-800">{copilotResult.summary}</p>
            </div>
            {copilotResult.dataQuality && <p className="text-xs text-gray-500">Confidence: {copilotResult.dataQuality.confidence} • Sample: {copilotResult.dataQuality.sampleSize} records • {copilotResult.processingTime}</p>}
          </Card>
          {copilotResult.evidence && copilotResult.evidence.length > 0 && (
            <Card title="📊 Evidence">
              <ul className="space-y-1">{copilotResult.evidence.map((e, i) => <li key={i} className="text-xs text-gray-700 pl-2 border-l-2 border-blue-200">{e}</li>)}</ul>
            </Card>
          )}
          {copilotResult.businessImpact && (
            <Card title="⚡ Business Impact">
              <Badge variant={copilotResult.businessImpact.level === 'HIGH' ? 'danger' : 'warning'}>{copilotResult.businessImpact.level}</Badge>
              <p className="text-xs text-gray-700 mt-1">{copilotResult.businessImpact.description}</p>
            </Card>
          )}
          {copilotResult.recommendations && (
            <Card title="💡 Actions">
              <ol className="space-y-1">{copilotResult.recommendations.map((r, i) => <li key={i} className="text-xs text-gray-700 flex gap-2"><span className="text-blue-600 font-bold">{i+1}.</span>{r}</li>)}</ol>
            </Card>
          )}
        </div>
      )}

      {/* RECALL */}
      {mode === 'recall' && recallResult && (
        <div className="space-y-3">
          <div className={`rounded-xl border-2 p-4 ${recallResult.riskLevel === 'HIGH' || recallResult.riskLevel === 'CRITICAL' ? 'bg-red-50 border-red-300' : 'bg-yellow-50 border-yellow-300'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase">Recall Impact — {recallResult.contaminatedLot.lotNumber}</p>
                <p className="text-2xl font-bold mt-1">{recallResult.riskScore}<span className="text-sm opacity-50">/120</span></p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div><p className="text-xl font-bold">{recallResult.impact.affectedProductionBatches}</p><p className="text-xs">Batches</p></div>
                <div><p className="text-xl font-bold">{recallResult.impact.affectedInventoryLocations}</p><p className="text-xs">Locations</p></div>
              </div>
            </div>
          </div>
          {recallGraph && recallGraph.nodes.length > 0 && (
            <Card title="📊 Contamination Flow">
              <div style={{ height: '250px' }} className="border border-gray-200 rounded-lg overflow-hidden">
                <ReactFlow nodes={flowNodes} edges={flowEdges} fitView attributionPosition="bottom-left"><Background /><Controls /></ReactFlow>
              </div>
            </Card>
          )}
          <Card title="💡 Actions">
            <ol className="space-y-1">{recallResult.recommendedActions.slice(0, 5).map((a, i) => <li key={i} className="text-xs text-gray-700 flex gap-2"><span className="text-red-600 font-bold">{i+1}.</span>{a}</li>)}</ol>
          </Card>
        </div>
      )}

      {/* REPORT */}
      {mode === 'report' && reportResult && (
        <div className="space-y-3">
          <div className={`rounded-xl border-2 p-4 ${reportResult.plantHealthScore >= 80 ? 'bg-green-50 border-green-300' : reportResult.plantHealthScore >= 50 ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-300'}`}>
            <p className="text-xs font-medium uppercase">Manufacturing Intelligence Report</p>
            <p className={`text-3xl font-bold mt-1 ${reportResult.plantHealthScore >= 80 ? 'text-green-700' : 'text-yellow-700'}`}>{reportResult.plantHealthScore}<span className="text-lg opacity-50">/100</span></p>
            <p className="text-sm font-medium">{reportResult.operationalStatus.replace('_', ' ')}</p>
          </div>
          <Card title="📝 Summary"><p className="text-sm text-gray-800">{reportResult.overview}</p></Card>
          {reportResult.risks.length > 0 && (
            <Card title="⚠️ Risks">
              <div className="space-y-1">{reportResult.risks.map((r, i) => (
                <div key={i} className="flex items-center gap-2"><Badge variant={r.severity === 'HIGH' ? 'danger' : 'warning'}>{r.severity}</Badge><span className="text-xs text-gray-700">{r.description}</span></div>
              ))}</div>
            </Card>
          )}
          {reportResult.recommendations.length > 0 && (
            <Card title="💡 Actions">
              <ol className="space-y-1">{reportResult.recommendations.map((r) => <li key={r.priority} className="text-xs text-gray-700 flex gap-2"><span className="text-blue-600 font-bold">{r.priority}.</span>{r.action}</li>)}</ol>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function OverviewCard({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  const colors: Record<string, string> = { green: 'bg-green-50 border-green-200 text-green-700', yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700', red: 'bg-red-50 border-red-200 text-red-700', blue: 'bg-blue-50 border-blue-200 text-blue-700' };
  return (
    <div className={`rounded-xl border p-3 text-center ${colors[color] || colors.blue}`}>
      <p className="text-xl font-bold">{value}{unit && <span className="text-xs opacity-60">{unit}</span>}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
}
