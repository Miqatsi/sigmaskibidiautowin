'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface ReportData {
  overview: string;
  plantHealthScore: number;
  operationalStatus: 'EXCELLENT' | 'GOOD' | 'ATTENTION_NEEDED' | 'CRITICAL';
  metrics: {
    qcPassRate: number;
    totalLots: number;
    pendingQCLots: number;
    activeProductionOrders: number;
    completedBatches: number;
    highRiskLots: number;
    supplierRiskCount: number;
    inventoryLocations: number;
    recentQCFailures: number;
    totalInventoryMovements: number;
  };
  risks: Array<{ severity: string; category: string; description: string; entity?: string }>;
  recommendations: Array<{ priority: number; action: string; reason: string; category: string }>;
  recentIssues: Array<{ type: string; description: string; timestamp: string; severity: string }>;
  generatedAt: string;
  processingTime: string;
}

function statusColor(status: string): string {
  switch (status) {
    case 'EXCELLENT': return 'bg-green-50 border-green-300 text-green-800';
    case 'GOOD': return 'bg-blue-50 border-blue-300 text-blue-800';
    case 'ATTENTION_NEEDED': return 'bg-yellow-50 border-yellow-300 text-yellow-800';
    case 'CRITICAL': return 'bg-red-50 border-red-300 text-red-800';
    default: return 'bg-gray-50 border-gray-300 text-gray-800';
  }
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-green-600';
  if (score >= 65) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function severityBadge(severity: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (severity) {
    case 'HIGH': case 'CRITICAL': return 'danger';
    case 'MEDIUM': return 'warning';
    default: return 'neutral';
  }
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generateReport() {
    setLoading(true);
    setError('');
    setReport(null);

    try {
      const res = await api.post<{ success: boolean; data: ReportData }>('/ai/report', { reportType: 'executive' });
      if (res.success && res.data) setReport(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal generate report.');
    } finally {
      setLoading(false);
    }
  }

  function copyReport() {
    if (!report) return;
    const text = [
      `MANUFACTURING INTELLIGENCE REPORT`,
      `Generated: ${new Date(report.generatedAt).toLocaleString('id-ID')}`,
      ``,
      `PLANT HEALTH SCORE: ${report.plantHealthScore}/100 (${report.operationalStatus})`,
      ``,
      `OVERVIEW:`,
      report.overview,
      ``,
      `KEY METRICS:`,
      `- QC Pass Rate: ${report.metrics.qcPassRate}%`,
      `- Total Lots: ${report.metrics.totalLots}`,
      `- Active Production: ${report.metrics.activeProductionOrders}`,
      `- QC Failures: ${report.metrics.recentQCFailures}`,
      `- Supplier Risks: ${report.metrics.supplierRiskCount}`,
      ``,
      `RISKS:`,
      ...report.risks.map((r) => `- [${r.severity}] ${r.description}`),
      ``,
      `RECOMMENDATIONS:`,
      ...report.recommendations.map((r) => `${r.priority}. ${r.action} (${r.reason})`),
    ].join('\n');
    navigator.clipboard.writeText(text);
    alert('Report copied to clipboard!');
  }

  function downloadJSON() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manufacturing-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 Manufacturing Intelligence Report</h1>
          <p className="text-base text-gray-600 mt-1">AI-powered executive summary of manufacturing operations</p>
        </div>
        <Button size="lg" onClick={generateReport} loading={loading}>
          {loading ? 'Analyzing operations...' : '📋 Generate Report'}
        </Button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      {loading && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-medium text-gray-700 mt-4">Analyzing manufacturing operations...</p>
            <p className="text-sm text-gray-500 mt-1">Gathering data from suppliers, QC, production, and inventory</p>
          </div>
        </Card>
      )}

      {report && (
        <div className="space-y-6">
          {/* Health Score Hero */}
          <div className={`rounded-xl border-2 p-6 ${statusColor(report.operationalStatus)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide opacity-80">Plant Health Score</p>
                <p className={`text-5xl font-bold mt-1 ${scoreColor(report.plantHealthScore)}`}>
                  {report.plantHealthScore}<span className="text-2xl opacity-50">/100</span>
                </p>
                <p className="text-lg font-semibold mt-1">{report.operationalStatus.replace('_', ' ')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-70">Generated</p>
                <p className="text-sm font-medium">{new Date(report.generatedAt).toLocaleString('id-ID')}</p>
                <p className="text-xs opacity-70 mt-1">Processing: {report.processingTime}</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="ghost" size="sm" onClick={copyReport}>📋 Copy</Button>
                  <Button variant="ghost" size="sm" onClick={downloadJSON}>⬇️ JSON</Button>
                </div>
              </div>
            </div>
          </div>

          {/* Overview */}
          <Card title="📝 Executive Summary">
            <p className="text-base text-gray-800 leading-relaxed">{report.overview}</p>
          </Card>

          {/* Key Metrics Grid */}
          <Card title="📈 Key Metrics">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricCard label="QC Pass Rate" value={`${report.metrics.qcPassRate}%`} good={report.metrics.qcPassRate >= 90} />
              <MetricCard label="Total Lots" value={report.metrics.totalLots.toString()} />
              <MetricCard label="Active Orders" value={report.metrics.activeProductionOrders.toString()} />
              <MetricCard label="QC Failures" value={report.metrics.recentQCFailures.toString()} bad={report.metrics.recentQCFailures > 0} />
              <MetricCard label="Supplier Risks" value={report.metrics.supplierRiskCount.toString()} bad={report.metrics.supplierRiskCount > 0} />
              <MetricCard label="Pending QC" value={report.metrics.pendingQCLots.toString()} bad={report.metrics.pendingQCLots > 0} />
              <MetricCard label="Completed Batches" value={report.metrics.completedBatches.toString()} />
              <MetricCard label="Inventory Locations" value={report.metrics.inventoryLocations.toString()} />
              <MetricCard label="High Risk Lots" value={report.metrics.highRiskLots.toString()} bad={report.metrics.highRiskLots > 0} />
              <MetricCard label="Inventory Moves" value={report.metrics.totalInventoryMovements.toString()} />
            </div>
          </Card>

          {/* Risks */}
          {report.risks.length > 0 && (
            <Card title="⚠️ Identified Risks">
              <div className="space-y-3">
                {report.risks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Badge variant={severityBadge(risk.severity)}>{risk.severity}</Badge>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{risk.description}</p>
                      <p className="text-xs text-gray-500">{risk.category}{risk.entity ? ` — ${risk.entity}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <Card title="💡 Recommendations">
              <div className="space-y-3">
                {report.recommendations.map((rec) => (
                  <div key={rec.priority} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">{rec.priority}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{rec.action}</p>
                      <p className="text-xs text-gray-500">{rec.reason} • {rec.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recent Issues */}
          {report.recentIssues.length > 0 && (
            <Card title="🕐 Recent Issues">
              <div className="space-y-2">
                {report.recentIssues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Badge variant={severityBadge(issue.severity)}>{issue.type}</Badge>
                    <span className="text-sm text-gray-700 flex-1">{issue.description}</span>
                    <span className="text-xs text-gray-500">{new Date(issue.timestamp).toLocaleDateString('id-ID')}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!report && !loading && !error && (
        <Card>
          <div className="text-center py-12">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-lg font-medium text-gray-700">Manufacturing Intelligence Report</p>
            <p className="text-sm text-gray-500 mt-1">Click &quot;Generate Report&quot; to analyze current manufacturing operations</p>
            <p className="text-xs text-gray-400 mt-3">Report includes: Plant Health Score, Key Metrics, Risks, Recommendations</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  const color = bad ? 'bg-red-50 border-red-200' : good ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200';
  const textColor = bad ? 'text-red-700' : good ? 'text-green-700' : 'text-gray-900';
  return (
    <div className={`rounded-lg border p-3 text-center ${color}`}>
      <p className={`text-xl font-bold ${textColor}`}>{value}</p>
      <p className="text-xs text-gray-600 mt-0.5">{label}</p>
    </div>
  );
}
