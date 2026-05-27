'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RawMaterialLot, ApiResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge, statusVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default function LotsPage() {
  const [lots, setLots] = useState<RawMaterialLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLots();
  }, []);

  async function loadLots() {
    try {
      setLoading(true);
      const res = await api.get<ApiResponse<RawMaterialLot[]>>('/lots?limit=50');
      if (res.success && res.data) {
        setLots(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data lot.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lot Tracking</h1>
          <p className="text-base text-gray-600 mt-1">
            Manage raw material lots and their QC status
          </p>
        </div>
        <Button size="md">+ Receive Lot</Button>
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
        ) : lots.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Belum ada lot yang terdaftar.</p>
            <p className="text-sm mt-1">Klik &quot;Receive Lot&quot; untuk menambahkan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Lot Number</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Material</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Supplier</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Qty</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Received</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono font-medium">{lot.lotNumber}</td>
                    <td className="py-3 px-4">{lot.material?.name || lot.materialId}</td>
                    <td className="py-3 px-4">{lot.supplier?.name || lot.supplierId}</td>
                    <td className="py-3 px-4">{lot.quantity} {lot.unit}</td>
                    <td className="py-3 px-4">
                      <Badge variant={statusVariant(lot.status)}>{lot.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(lot.receivedAt).toLocaleDateString('id-ID')}
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
