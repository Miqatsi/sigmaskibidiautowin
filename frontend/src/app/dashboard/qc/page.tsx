'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { QCLog, ApiResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge, statusVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default function QCPage() {
  const [logs, setLogs] = useState<QCLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quality Control</h1>
          <p className="text-base text-gray-600 mt-1">
            QC inspection logs and results
          </p>
        </div>
        <Button size="md">+ New Inspection</Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
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
