'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { InventoryTransaction, ProductionBatch, ApiResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface StorageLocation {
  id: string;
  name: string;
  code: string;
  warehouse?: { name: string };
}

function txTypeVariant(type: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (type) {
    case 'IN': return 'success';
    case 'OUT': case 'CONSUME': case 'SHIP': return 'danger';
    case 'TRANSFER': return 'info';
    case 'ADJUSTMENT': return 'warning';
    default: return 'neutral';
  }
}

export default function InventoryPage() {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);

  // Form state
  const [txType, setTxType] = useState('IN');
  const [storageLocationId, setStorageLocationId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('bottle');
  const [reference, setReference] = useState('');

  useEffect(() => { loadTransactions(); }, []);

  async function loadTransactions() {
    try {
      setLoading(true);
      const res = await api.get<ApiResponse<InventoryTransaction[]>>('/inventory/transactions?limit=50');
      if (res.success && res.data) setTransactions(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data inventory.');
    } finally {
      setLoading(false);
    }
  }

  async function openForm() {
    setShowForm(true);
    setFormError('');
    try {
      const [locRes, batchRes] = await Promise.all([
        api.get<{ success: boolean; data: StorageLocation[] }>('/warehouses/locations'),
        api.get<ApiResponse<ProductionBatch[]>>('/production/batches?limit=100'),
      ]);
      if (locRes.success && locRes.data) setLocations(locRes.data);
      if (batchRes.success && batchRes.data) setBatches(batchRes.data);
    } catch { /* ignore */ }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const res = await api.post<ApiResponse<InventoryTransaction>>('/inventory/transactions', {
        type: txType,
        storageLocationId,
        batchId: batchId || undefined,
        quantity: parseFloat(quantity),
        unit,
        reference: reference || undefined,
      });
      if (res.success) {
        setShowForm(false);
        setTxType('IN'); setStorageLocationId(''); setBatchId(''); setQuantity(''); setReference('');
        await loadTransactions();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal mencatat transaksi.');
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-base text-gray-600 mt-1">Warehouse inventory transactions</p>
        </div>
        <Button size="md" onClick={openForm}>+ New Transaction</Button>
      </div>

      {showForm && (
        <Card title="New Inventory Transaction" action={<Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>✕</Button>}>
          {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="txType" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select id="txType" value={txType} onChange={(e) => setTxType(e.target.value)} className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'CONSUME', 'SHIP'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="locationId" className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
              <select id="locationId" value={storageLocationId} onChange={(e) => setStorageLocationId(e.target.value)} required className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Pilih lokasi...</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="batchId" className="block text-sm font-medium text-gray-700 mb-1">Batch (optional)</label>
              <select id="batchId" value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— No batch —</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.lotNumber} ({b.status})</option>)}
              </select>
            </div>
            <Input id="quantity" label="Quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            <Input id="unit" label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} required />
            <Input id="reference" label="Reference (optional)" placeholder="e.g. Dispatch #001" value={reference} onChange={(e) => setReference(e.target.value)} />
            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Batal</Button>
              <Button type="submit" loading={formLoading}>Record Transaction</Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error} <Button variant="ghost" size="sm" className="ml-3" onClick={loadTransactions}>Retry</Button>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><p className="text-lg">Belum ada transaksi inventory.</p></div>
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
                    <td className="py-3 px-4"><Badge variant={txTypeVariant(tx.type)}>{tx.type}</Badge></td>
                    <td className="py-3 px-4">{tx.storageLocation?.name || tx.storageLocationId}</td>
                    <td className="py-3 px-4 font-mono text-sm">{tx.batch?.lotNumber || '—'}</td>
                    <td className="py-3 px-4">{tx.quantity} {tx.unit}</td>
                    <td className="py-3 px-4 text-gray-600">{tx.reference || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(tx.createdAt).toLocaleDateString('id-ID')}</td>
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
