'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { InventoryTransaction, ApiResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

function txTypeVariant(type: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (type) {
    case 'IN': return 'success';
    case 'OUT': return 'danger';
    case 'TRANSFER': return 'info';
    case 'ADJUSTMENT': return 'warning';
    default: return 'neutral';
  }
}

export default function InventoryPage() {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    try {
      setLoading(true);
      const res = await api.get<ApiResponse<InventoryTransaction[]>>('/inventory?limit=50');
      if (res.success && res.data) {
        setTransactions(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data inventory.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-base text-gray-600 mt-1">
            Warehouse inventory transactions
          </p>
        </div>
        <Button size="md">+ New Transaction</Button>
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
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Belum ada transaksi inventory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Batch</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Qty</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Reference</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Badge variant={txTypeVariant(tx.type)}>{tx.type}</Badge>
                    </td>
                    <td className="py-3 px-4">{tx.storageLocation?.name || tx.storageLocationId}</td>
                    <td className="py-3 px-4 font-mono text-sm">{tx.batch?.lotNumber || '—'}</td>
                    <td className="py-3 px-4">{tx.quantity} {tx.unit}</td>
                    <td className="py-3 px-4 text-gray-600">{tx.reference || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(tx.createdAt).toLocaleDateString('id-ID')}
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
