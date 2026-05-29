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
interface AlertItem { id: string; type: string; severity: string; title: string; description: string; recommendedAction: string; businessImpact: string; link?: string }
interface AlertsData { alerts: AlertItem[]; summary: { critical: number; high: number; medium: number; low: number; total: number } }

interface CopilotResponse {
  summary: string; confidence: number; riskLevel: string; intent: string;
  evidence?: string[]; recommendations?: string[]; rootCauses?: string[];
  relatedEntities?: { suppliers: Array<{name: string}>; lots: Array<{lotNumber: string; status: string}>; productionBatches: Array<{lotNumber: string}>; inventory: Array<{location: string; quantity: number}> };
  supplierAnalysis?: { supplier: string; failureRate: number; totalInspections: number; failedLots: string[] };
  processingTime?: string;
}

interface RecallData {
  contaminatedLot: { lotNumber: string; supplier: string; material: string; status: string };
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

  // AI State
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

    setLoading(true);
    setError('');
    setCopilotResult(null);
    setRecallResult(null);
    setRecallGraph(null);
    setReportResult(null);

    const q = question.toLowerCase();

    try {
      // Detect if user wants a report
      if (q.includes('report') || q.includes('executive') || q.includes('board') || q.includes('laporan')) {
        setMode('report');
        const res = await api.post<{ success: boolean; data: ReportData }>('/ai/report', { reportType: 'executive' });
        if (res.success && res.data) setReportResult(res.data);
        setLoading(false);
        return;
      }

      // Detect if user wants recall simulation
      const lotMatch = question.match(/\b([A-Z]{2,}-[\w-]+)\b/i);
      if (lotMatch && (q.includes('contaminated') || q.includes('recall') || q.includes('affected') || q.includes('impact') || q.includes('what happens'))) {
        setMode('recall');
        const lotNumber = lotMatch[1];
        const [recallRes, graphRes] = await Promise.all([
          api.get<{ success: boolean; data: RecallData }>(`/traceability/recall/${encodeURIComponent(lotNumber)}`),
          api.get<{ success: boolean; data: GraphData }>(`/traceability/recall/${encodeURIComponent(lotNumber)}/graph`),
        ]);
        if (recallRes.success && recallRes.data) setRecallResult(recallRes.data);
        if (graphRes.success && graphRes.data) setRecallGraph(graphRes.data);
        setLoading(false);
        return;
      }

      // Default: AI Copilot
      setMode('copilot');
      const res = await api.post<{ success: boolean; data: CopilotResponse }>('/ai/copilot', { question });
      if (res.success && res.data) setCopilotResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  }, [question]);

  function askExample(q: string) { setQuestion(q); }

  // ReactFlow nodes/edges for recall
  const flowNodes: Node[] = recallGraph?.nodes.map((n, i) => ({
    id: n.id, position: { x: 250, y: i * 140 },
    data: { label: <div className="text-center"><div className="text-xs font-bold uppercase" style={{ color: n.type === 'LOT' ? '#ef4444' : n.type === 'BATCH' ? '#f59e0b' : '#3b82f6' }}>{n.type}</div><div className="text-sm font-medium mt-1">{n.label}</div></div> },
    style: { border: `2px solid ${n.type === 'LOT' ? '#ef4444' : n.type === 'BATCH' ? '#f59e0b' : '#3b82f6'}`, borderRadius: '12px', padding: '10px', background: 'white', width: 260 },
  })) || [];
  const flowEdges: Edge[] = recallGraph?.edges.map((e, i) => ({ id: `e-${i}`, source: e.source, target: e.target, label: e.label, animated: true, markerEnd: { type: MarkerType.ArrowClosed } })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🧠 Manufacturing Intelligence Center</h1>
        <p className="text-base text-gray-600 mt-1">Unified AI workspace — ask questions, review alerts, generate reports</p>
      </div>

      {/* Section 1: Executive Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <OverviewCard label="Plant Health" value={summary ? `${summary.healthScore}/100` : '—'} color={summary && summary.healthScore >= 80 ? 'green' : summary && summary.healthScore >= 50 ? 'yellow' : 'red'} />
        <OverviewCard label="Critical Alerts" value={alertSummary ? `${alertSummary.critical + alertSummary.high}` : '—'} color={alertSummary && (alertSummary.critical + alertSummary.high) > 0 ? 'red' : 'green'} />
        <OverviewCard label="Pending QC" value={summary?.pendingQC?.toString() || '—'} color={summary && summary.pendingQC > 0 ? 'yellow' : 'green'} />
        <OverviewCard label="Active Production" value={summary?.activeOrders?.toString() || '—'} color="blue" />
      </div>

      {/* Section 2: Alerts */}
      {alerts.length > 0 && (
        <Card title="🚨 Operational Alerts" action={<Link href="/dashboard/alerts" className="text-sm text-blue-600 hover:underline">View All →</Link>}>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => { setQuestion(alert.title); }}>
                <span>{alert.severity === 'CRITICAL' ? '🔴' : alert.severity === 'HIGH' ? '🟠' : '🟡'}</span>
                <span className="text-sm text-gray-800 flex-1 truncate">{alert.title}</span>
                <Badge variant={alert.severity === 'HIGH' || alert.severity === 'CRITICAL' ? 'danger' : 'warning'}>{alert.severity}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Section 3: AI Assistant Input */}
      <Card>
        <form onSubmit={handleAsk} className="space-y-3">
          <label htmlFor="ai-input" className="block text-sm font-medium text-gray-700">🤖 AI Manufacturing Assistant</label>
          <textarea
            id="ai-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Ask about suppliers, lots, QC failures, production issues, inventory risk, traceability, or recalls..."
          />
          <div className="flex items-center gap-3">
            <Button type="submit" loading={loading} size="md">🔍 Analyze</Button>
            {copilotResult && <span className="text-xs text-gray-500">{copilotResult.processingTime} • {copilotResult.confidence}% confidence</span>}
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            {['Why is PT Bahan Murah Jaya risky?', 'What happens if RM-DEMO-001 is contaminated?', 'Generate executive report', 'Which production orders are blocked?', 'Why did lot RM-DEMO-002 fail QC?'].map((q) => (
              <button key={q} type="button" onClick={() => askExample(q)} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors">{q}</button>
            ))}
          </div>
        </form>
      </Card>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      {/* Section 4: Dynamic Analysis Results */}
      {loading && (
        <Card>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-600">Analyzing manufacturing data...</span>
          </div>
        </Card>
      )}

      {/* COPILOT RESULT */}
      {mode === 'copilot' && copilotResult && (
        <div className="space-y-4">
          <Card title={`📋 ${copilotResult.intent.replace('_', ' ')} Analysis`}>
            <div className="flex items-start gap-3 mb-4">
              <Badge variant={copilotResult.riskLevel === 'HIGH' || copilotResult.riskLevel === 'CRITICAL' ? 'danger' : copilotResult.riskLevel === 'MEDIUM' ? 'warning' : 'success'}>
                {copilotResult.riskLevel}
              </Badge>
              <p className="text-base text-gray-800">{copilotResult.summary}</p>
            </div>
            {copilotResult.evidence && copilotResult.evidence.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">📊 Evidence</h4>
                <ul className="space-y-1">
                  {copilotResult.evidence.map((e, i) => <li key={i} className="text-sm text-gray-600 pl-3 border-l-2 border-blue-200">{e}</li>)}
                </ul>
              </div>
            )}
          </Card>
          {copilotResult.recommendations && copilotResult.recommendations.length > 0 && (
            <Card title="💡 Recommendations">
              <ol className="space-y-2">
                {copilotResult.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i+1}</span><span className="text-gray-700">{r}</span></li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}

      {/* RECALL RESULT */}
      {mode === 'recall' && recallResult && (
        <div className="space-y-4">
          <div className={`rounded-xl border-2 p-5 ${recallResult.riskLevel === 'HIGH' || recallResult.riskLevel === 'CRITICAL' ? 'bg-red-50 border-red-300' : 'bg-yellow-50 border-yellow-300'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase">Recall Impact — {recallResult.contaminatedLot.lotNumber}</p>
                <p className="text-3xl font-bold mt-1">{recallResult.riskScore}<span className="text-lg opacity-50">/120</span></p>
                <p className="font-semibold">{recallResult.riskLevel}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div><p className="text-2xl font-bold">{recallResult.impact.affectedProductionBatches}</p><p className="text-xs">Batches</p></div>
                <div><p className="text-2xl font-bold">{recallResult.impact.affectedInventoryLocations}</p><p className="text-xs">Locations</p></div>
              </div>
            </div>
          </div>
          {recallGraph && recallGraph.nodes.length > 0 && (
            <Card title="📊 Contamination Flow">
              <div style={{ height: '300px' }} className="border border-gray-200 rounded-lg overflow-hidden">
                <ReactFlow nodes={flowNodes} edges={flowEdges} fitView attributionPosition="bottom-left"><Background /><Controls /></ReactFlow>
              </div>
            </Card>
          )}
          <Card title="💡 Recommended Actions">
            <ol className="space-y-2">
              {recallResult.recommendedActions.map((a, i) => <li key={i} className="flex items-start gap-2 text-sm"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">{i+1}</span><span className="text-gray-700">{a}</span></li>)}
            </ol>
          </Card>
        </div>
      )}

      {/* REPORT RESULT */}
      {mode === 'report' && reportResult && (
        <div className="space-y-4">
          <div className={`rounded-xl border-2 p-5 ${reportResult.plantHealthScore >= 80 ? 'bg-green-50 border-green-300' : reportResult.plantHealthScore >= 50 ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-300'}`}>
            <p className="text-sm font-medium uppercase">Manufacturing Intelligence Report</p>
            <p className={`text-4xl font-bold mt-1 ${reportResult.plantHealthScore >= 80 ? 'text-green-700' : reportResult.plantHealthScore >= 50 ? 'text-yellow-700' : 'text-red-700'}`}>{reportResult.plantHealthScore}<span className="text-xl opacity-50">/100</span></p>
            <p className="font-semibold">{reportResult.operationalStatus.replace('_', ' ')}</p>
          </div>
          <Card title="📝 Executive Summary">
            <p className="text-base text-gray-800 leading-relaxed">{reportResult.overview}</p>
          </Card>
          {reportResult.risks.length > 0 && (
            <Card title="⚠️ Risks">
              <div className="space-y-2">
                {reportResult.risks.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <Badge variant={r.severity === 'HIGH' || r.severity === 'CRITICAL' ? 'danger' : 'warning'}>{r.severity}</Badge>
                    <span className="text-sm text-gray-700">{r.description}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {reportResult.recommendations.length > 0 && (
            <Card title="💡 Recommendations">
              <ol className="space-y-2">
                {reportResult.recommendations.map((r) => <li key={r.priority} className="flex items-start gap-2 text-sm"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{r.priority}</span><span className="text-gray-700">{r.action}</span></li>)}
              </ol>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function OverviewCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
  };
  return (
    <div className={`rounded-xl border p-4 text-center ${colors[color] || colors.blue}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1">{label}</p>
    </div>
  );
}
