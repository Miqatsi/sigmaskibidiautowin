'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RawMaterial, ApiResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [unit, setUnit] = useState('kg');

  useEffect(() => { loadMaterials(); }, []);

  async function loadMaterials() {
    try {
      setLoading(true);
      const res = await api.get<ApiResponse<RawMaterial[]>>('/materials?limit=50');
      if (res.success && res.data) setMaterials(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data material.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const res = await api.post<ApiResponse<RawMaterial>>('/materials', { name, code, unit });
      if (res.success) {
        setShowForm(false);
        setName(''); setCode(''); setUnit('kg');
        await loadMaterials();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membuat material.');
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raw Materials</h1>
          <p className="text-base text-gray-600 mt-1">Manage raw material catalog</p>
        </div>
        <Button size="md" onClick={() => { setShowForm(true); setFormError(''); }}>+ Add Material</Button>
      </div>

      {showForm && (
        <Card title="Add New Material" action={<Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>✕</Button>}>
          {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input id="name" label="Nama Material" placeholder="e.g. Citric Acid" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input id="code" label="Kode" placeholder="e.g. RM-006" value={code} onChange={(e) => setCode(e.target.value)} required />
            <Input id="unit" label="Satuan" placeholder="kg, liter, pcs" value={unit} onChange={(e) => setUnit(e.target.value)} required />
            <div className="md:col-span-3 flex gap-3 justify-end">
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Batal</Button>
              <Button type="submit" loading={formLoading}>Simpan</Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error} <Button variant="ghost" size="sm" className="ml-3" onClick={loadMaterials}>Retry</Button>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : materials.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><p className="text-lg">Belum ada material terdaftar.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Unit</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono font-medium">{m.code}</td>
                    <td className="py-3 px-4 font-medium">{m.name}</td>
                    <td className="py-3 px-4 text-gray-600">{m.unit}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(m.createdAt).toLocaleDateString('id-ID')}</td>
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
