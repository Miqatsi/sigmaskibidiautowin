'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface AIResponse {
  summary: string;
  confidence: number;
  riskLevel: string;
  intent: string;
  dataQuality?: { confidence: string; sampleSize: number; dataQuality: string; note?: string };
  evidence?: string[];
  rootCauses?: string[];
  recommendations?: string[];
  businessImpact?: { level: string; description: string; affectedBatches?: number; affectedOrders?: number };
  riskContributors?: Array<{ category: string; score: number; description: string }>;
  metrics?: Record<string, string | number>;
  relatedEntities?: { suppliers: Array<{name: string}>; lots: Array<{lotNumber: string}>; productionBatches: Array<{lotNumber: string}>; inventory: Array<{location: string}> };
  supplierAnalysis?: { supplier: string; failureRate: number; totalInspections: number };
  processingTime?: string;
  provider?: string;
}

const EXAMPLE_QUESTIONS = [
  'Why is PT Bahan Murah Jaya risky?',
  'Which supplier has the highest QC failure rate?',
  'Why did lot RM-DEMO-002 fail QC?',
  'Which production orders are blocked?',
  'Which inventory is most vulnerable?',
  'What are the top operational risks today?',
];

function riskColor(level?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (level) {
    case 'LOW': return 'success';
    case 'MEDIUM': return 'warning';
    case 'HIGH': case 'CRITICAL': return 'danger';
    default: return 'neutral';
  }
}

export default function AICopilotPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.post<{ success: boolean; data: AIResponse }>('/ai/copilot', { question });
      if (res.success && res.data) {
        setResult(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI analysis gagal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🤖 AI Manufacturing Copilot</h1>
        <p className="text-base text-gray-600 mt-1">
          Ask about suppliers, lots, QC failures, production issues, inventory risk, or traceability
        </p>
      </div>

      {/* Input */}
      <Card>
        <form onSubmit={handleAsk} className="space-y-4">
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-1">Pertanyaan</label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Why is PT Bahan Murah Jaya risky?"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={loading} size="md">🔍 Analyze</Button>
            {result && (
              <span className="text-sm text-gray-500">
                {result.processingTime} • {result.confidence}% confidence • {result.provider}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 w-full mb-1">Contoh pertanyaan:</p>
            {EXAMPLE_QUESTIONS.map((q) => (
              <button key={q} type="button" onClick={() => setQuestion(q)} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors">{q}</button>
            ))}
          </div>
        </form>
      </Card>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card title={`📋 ${result.intent.replace(/_/g, ' ')} Analysis`}>
            <div className="flex items-start gap-3 mb-3">
              <Badge variant={riskColor(result.riskLevel)}>{result.riskLevel}</Badge>
              <p className="text-base text-gray-800">{result.summary}</p>
            </div>
            {result.dataQuality && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                <span>Data Confidence: <strong>{result.dataQuality.confidence}</strong></span>
                <span>•</span>
                <span>Sample Size: {result.dataQuality.sampleSize}</span>
                {result.dataQuality.note && <span>• {result.dataQuality.note}</span>}
              </div>
            )}
          </Card>

          {/* Evidence */}
          {result.evidence && result.evidence.length > 0 && (
            <Card title="📊 Evidence">
              <ul className="space-y-1">
                {result.evidence.map((e, i) => (
                  <li key={i} className="text-sm text-gray-700 pl-3 border-l-2 border-blue-200">{e}</li>
                ))}
              </ul>
            </Card>
          )}

          {/* Business Impact */}
          {result.businessImpact && (
            <Card title="⚡ Business Impact">
              <div className="flex items-start gap-2">
                <Badge variant={riskColor(result.businessImpact.level)}>{result.businessImpact.level}</Badge>
                <p className="text-sm text-gray-700">{result.businessImpact.description}</p>
              </div>
              {(result.businessImpact.affectedBatches || result.businessImpact.affectedOrders) && (
                <div className="flex gap-4 mt-3 pt-2 border-t border-gray-100">
                  {result.businessImpact.affectedBatches !== undefined && <span className="text-sm"><strong>{result.businessImpact.affectedBatches}</strong> batches affected</span>}
                  {result.businessImpact.affectedOrders !== undefined && <span className="text-sm"><strong>{result.businessImpact.affectedOrders}</strong> orders affected</span>}
                </div>
              )}
            </Card>
          )}

          {/* Risk Contributors */}
          {result.riskContributors && result.riskContributors.length > 0 && (
            <Card title="🎯 Risk Contributors">
              <div className="space-y-2">
                {result.riskContributors.map((rc, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-bold">{rc.score}</div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{rc.category}</p>
                      <p className="text-xs text-gray-600">{rc.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Metrics */}
          {result.metrics && Object.keys(result.metrics).length > 0 && (
            <Card title="📈 Supporting Metrics">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(result.metrics).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-600">{key}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <Card title="💡 Recommended Actions">
              <ol className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm text-gray-700">{r}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
