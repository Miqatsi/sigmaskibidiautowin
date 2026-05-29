'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface AIResponse {
  summary: string;
  rootCauses?: string[];
  recommendations?: string[];
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedLots?: string[];
  affectedBatches?: string[];
  supplierAnalysis?: { supplier: string; failureRate: number; totalInspections: number };
  processingTime?: string;
  provider?: string;
}

const EXAMPLE_QUESTIONS = [
  'Why did lot RM-E2E-001 fail QC?',
  'What customers are affected if RM-E2E-001 is contaminated?',
  'Which supplier has the highest QC failure rate?',
  'Trace lot FG-E2E-001',
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

  function askExample(q: string) {
    setQuestion(q);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🤖 AI Manufacturing Copilot</h1>
        <p className="text-base text-gray-600 mt-1">
          Tanya apa saja tentang manufacturing — QC failures, supplier risk, lot traceability, impact analysis
        </p>
      </div>

      {/* Input */}
      <Card>
        <form onSubmit={handleAsk} className="space-y-4">
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-1">
              Pertanyaan
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Why did lot RM-001 fail QC?"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={loading} size="md">
              🔍 Analyze
            </Button>
            {result && (
              <span className="text-sm text-gray-500">
                Processed in {result.processingTime} ({result.provider} provider)
              </span>
            )}
          </div>
        </form>

        {/* Example questions */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500 mb-2">Contoh pertanyaan:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => askExample(q)}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <Card title="📋 Analysis Summary">
            <div className="flex items-start gap-3">
              {result.riskLevel && (
                <Badge variant={riskColor(result.riskLevel)}>
                  Risk: {result.riskLevel}
                </Badge>
              )}
              <p className="text-base text-gray-800">{result.summary}</p>
            </div>
          </Card>

          {/* Root Causes */}
          {result.rootCauses && result.rootCauses.length > 0 && (
            <Card title="🔍 Root Causes">
              <ul className="space-y-2">
                {result.rootCauses.map((cause, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-500 font-bold mt-0.5">•</span>
                    <span className="text-base text-gray-700">{cause}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <Card title="💡 Recommendations">
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">{i + 1}.</span>
                    <span className="text-base text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Affected Items */}
          {(result.affectedLots?.length || result.affectedBatches?.length) && (
            <Card title="⚠️ Affected Items">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.affectedLots && result.affectedLots.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Affected Lots:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.affectedLots.map((lot) => (
                        <Badge key={lot} variant="danger">{lot}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {result.affectedBatches && result.affectedBatches.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Affected Batches:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.affectedBatches.map((batch, i) => (
                        <Badge key={i} variant="warning">{batch}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Supplier Analysis */}
          {result.supplierAnalysis && (
            <Card title="📊 Supplier Analysis">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Supplier</p>
                  <p className="text-lg font-semibold">{result.supplierAnalysis.supplier}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Failure Rate</p>
                  <p className="text-lg font-semibold text-red-600">{result.supplierAnalysis.failureRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Inspections</p>
                  <p className="text-lg font-semibold">{result.supplierAnalysis.totalInspections}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
