'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Supplier, ApiResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => { loadSuppliers(); }, []);

  async function loadSuppliers() {
    try {
      setLoading(true);
      const res = await api.get<ApiResponse<Supplier[]>>('/suppliers?limit=50');
      if (res.success && res.data) setSuppliers(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data supplier.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const res = await api.post<ApiResponse<Supplier>>('/suppliers', {
        name, code, contactName: contactName || undefined, phone: phone || undefined, email: email || undefined,
      });
      if (res.success) {
        setShowForm(false);
        setName(''); setCode(''); setContactName(''); setPhone(''); setEmail('');
        await loadSuppliers();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membuat supplier.');
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-base text-gray-600 mt-1">Manage raw material suppliers</p>
        </div>
        <Button size="md" onClick={() => { setShowForm(true); setFormError(''); }}>+ Add Supplier</Button>
      </div>

      {showForm && (
        <Card title="Add New Supplier" action={<Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>✕</Button>}>
          {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input id="name" label="Nama Supplier" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input id="code" label="Kode" placeholder="e.g. SUP-004" value={code} onChange={(e) => setCode(e.target.value)} required />
            <Input id="contactName" label="Contact Person" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Input id="phone" label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Batal</Button>
              <Button type="submit" loading={formLoading}>Simpan</Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error} <Button variant="ghost" size="sm" className="ml-3" onClick={loadSuppliers}>Retry</Button>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><p className="text-lg">Belum ada supplier terdaftar.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Phone</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono font-medium">{s.code}</td>
                    <td className="py-3 px-4 font-medium">{s.name}</td>
                    <td className="py-3 px-4 text-gray-600">{s.contactName || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{s.phone || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{s.email || '—'}</td>
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
