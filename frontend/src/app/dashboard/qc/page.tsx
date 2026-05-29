'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { QCLog, RawMaterialLot, ApiResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge, statusVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default function QCPage() {
  const [logs, setLogs] = useState<QCLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pendingLots, setPendingLots] = useState<RawMaterialLot[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Form state
  const [selectedLotId, setSelectedLotId] = useState('');
  const [qcResult, setQcResult] = useState<'PASS' | 'FAIL' | 'CONDITIONAL'>('PASS');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadQCLogs();
  }, []);

  async function loadQCLogs() {
    try {
      setLoading(true);
      const res = await api.get<ApiResponse<QCLog[]>>('/qc?limit=50');
      if (res.success && res.data) {
        setLogs(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data QC.');
    } finally {
      setLoading(false);
    }
  }

  async function openForm() {
    setShowForm(true);
    setFormError('');
    try {
      const res = await api.get<ApiResponse<RawMaterialLot[]>>('/lots?status=PENDING_QC&limit=100');
      if (res.success && res.data) {
        setPendingLots(res.data);
      }
    } catch {
      setFormError('Gagal memuat lot yang pending QC.');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      const res = await api.post<ApiResponse<QCLog>>('/qc', {
        type: 'INCOMING',
        result: qcResult,
        rawMaterialLotId: selectedLotId,
        notes: notes || undefined,
      });

      if (res.success) {
        setShowForm(false);
        setSelectedLotId('');
        setQcResult('PASS');
        setNotes('');
        await loadQCLogs();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membuat QC inspection.');
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quality Control</h1>
          <p className="text-base text-gray-600 mt-1">
            QC inspection logs and results
          </p>
        </div>
        <Button size="md" onClick={openForm}>+ New Inspection</Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card title="New QC Inspection" action={<Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>✕</Button>}>
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="lotSelect" className="block text-sm font-medium text-gray-700 mb-1">Lot (Pending QC)</label>
              <select id="lotSelect" value={selectedLotId} onChange={(e) => setSelectedLotId(e.target.value)} required className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Pilih lot...</option>
                {pendingLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.lotNumber} — {lot.material?.name || 'Unknown'} ({lot.quantity} {lot.unit})
                  </option>
                ))}
              </select>
              {pendingLots.length === 0 && <p className="text-sm text-gray-500 mt-1">Tidak ada lot yang pending QC.</p>}
            </div>
            <div>
              <label htmlFor="qcResult" className="block text-sm font-medium text-gray-700 mb-1">Result</label>
              <div className="flex gap-3">
                {(['PASS', 'FAIL', 'CONDITIONAL'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setQcResult(r)}
                    className={`px-4 py-2 rounded-lg border font-medium text-sm transition-colors ${
                      qcResult === r
                        ? r === 'PASS' ? 'bg-green-100 border-green-500 text-green-800'
                          : r === 'FAIL' ? 'bg-red-100 border-red-500 text-red-800'
                          : 'bg-yellow-100 border-yellow-500 text-yellow-800'
                        : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Catatan inspeksi..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Batal</Button>
              <Button type="submit" loading={formLoading}>Submit Inspection</Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <Button variant="ghost" size="sm" className="ml-3" onClick={loadQCLogs}>Retry</Button>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Belum ada inspeksi QC.</p>
            <p className="text-sm mt-1">Klik &quot;New Inspection&quot; untuk memulai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Result</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Lot / Batch</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Notes</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Badge variant="info">{log.type}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={statusVariant(log.result)}>{log.result}</Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm">
                      {log.rawMaterialLot?.lotNumber || log.batch?.lotNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                      {log.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(log.createdAt).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
