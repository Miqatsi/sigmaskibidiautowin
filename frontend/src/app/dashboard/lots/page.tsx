'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RawMaterialLot, Supplier, RawMaterial, ApiResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge, statusVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LotsPage() {
  const [lots, setLots] = useState<RawMaterialLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Form state
  const [lotNumber, setLotNumber] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');

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

  async function openForm() {
    setShowForm(true);
    setFormError('');
    // Load suppliers and materials for dropdowns
    try {
      const [supRes, matRes] = await Promise.all([
        api.get<ApiResponse<Supplier[]>>('/suppliers?limit=100'),
        api.get<ApiResponse<RawMaterial[]>>('/materials?limit=100'),
      ]);
      if (supRes.success && supRes.data) setSuppliers(supRes.data);
      if (matRes.success && matRes.data) setMaterials(matRes.data);
    } catch {
      setFormError('Gagal memuat data supplier/material.');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      const res = await api.post<ApiResponse<RawMaterialLot>>('/lots', {
        lotNumber,
        materialId,
        supplierId,
        quantity: parseFloat(quantity),
        unit,
      });

      if (res.success) {
        setShowForm(false);
        setLotNumber('');
        setMaterialId('');
        setSupplierId('');
        setQuantity('');
        await loadLots();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membuat lot.');
    } finally {
      setFormLoading(false);
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
        <Button size="md" onClick={openForm}>+ Receive Lot</Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card title="Receive New Lot" action={<Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>✕</Button>}>
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input id="lotNumber" label="Lot Number" placeholder="e.g. RM-2026-001" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} required />
            <div>
              <label htmlFor="materialId" className="block text-sm font-medium text-gray-700 mb-1">Material</label>
              <select id="materialId" value={materialId} onChange={(e) => setMaterialId(e.target.value)} required className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Pilih material...</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select id="supplierId" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Pilih supplier...</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <Input id="quantity" label="Quantity" type="number" placeholder="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            <Input id="unit" label="Unit" placeholder="kg" value={unit} onChange={(e) => setUnit(e.target.value)} required />
            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Batal</Button>
              <Button type="submit" loading={formLoading}>Simpan Lot</Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <Button variant="ghost" size="sm" className="ml-3" onClick={loadLots}>Retry</Button>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
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
