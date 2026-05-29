'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ProductionOrder, Product, RawMaterialLot, ApiResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge, statusVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ProductionPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Order form
  const [orderNumber, setOrderNumber] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('bottle');
  const [plannedDate, setPlannedDate] = useState('');
  const [products, setProducts] = useState<Product[]>([]);

  // Batch form
  const [batchLotNumber, setBatchLotNumber] = useState('');
  const [batchOrderId, setBatchOrderId] = useState('');
  const [batchQuantity, setBatchQuantity] = useState('');
  const [batchUnit, setBatchUnit] = useState('bottle');
  const [approvedLots, setApprovedLots] = useState<RawMaterialLot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [lotQtyUsed, setLotQtyUsed] = useState('');
  const [lotUnit, setLotUnit] = useState('kg');

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      const res = await api.get<ApiResponse<ProductionOrder[]>>('/production/orders?limit=50');
      if (res.success && res.data) setOrders(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data produksi.');
    } finally {
      setLoading(false);
    }
  }

  async function openOrderForm() {
    setShowOrderForm(true);
    setFormError('');
    try {
      const res = await api.get<{ success: boolean; data: Product[] }>('/warehouses/products');
      if (res.success && res.data) setProducts(res.data);
    } catch { /* ignore */ }
  }

  async function openBatchForm() {
    setShowBatchForm(true);
    setFormError('');
    try {
      const res = await api.get<ApiResponse<RawMaterialLot[]>>('/lots?status=APPROVED&limit=100');
      if (res.success && res.data) setApprovedLots(res.data);
    } catch { /* ignore */ }
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const res = await api.post<ApiResponse<ProductionOrder>>('/production/orders', {
        orderNumber,
        productId,
        quantity: parseFloat(quantity),
        unit,
        plannedDate: new Date(plannedDate).toISOString(),
      });
      if (res.success) {
        setShowOrderForm(false);
        setOrderNumber(''); setProductId(''); setQuantity(''); setPlannedDate('');
        await loadOrders();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membuat order.');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const res = await api.post<ApiResponse<unknown>>('/production/batches', {
        lotNumber: batchLotNumber,
        orderId: batchOrderId,
        quantity: parseFloat(batchQuantity),
        unit: batchUnit,
        rawMaterialLotIds: [{ lotId: selectedLotId, quantityUsed: parseFloat(lotQtyUsed), unit: lotUnit }],
      });
      if (res.success) {
        setShowBatchForm(false);
        setBatchLotNumber(''); setBatchOrderId(''); setBatchQuantity(''); setSelectedLotId(''); setLotQtyUsed('');
        await loadOrders();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membuat batch.');
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production</h1>
          <p className="text-base text-gray-600 mt-1">Production orders and batch management</p>
        </div>
        <div className="flex gap-2">
          <Button size="md" onClick={openOrderForm}>+ New Order</Button>
          <Button size="md" variant="secondary" onClick={openBatchForm}>+ New Batch</Button>
        </div>
      </div>

      {/* Order Form */}
      {showOrderForm && (
        <Card title="New Production Order" action={<Button variant="ghost" size="sm" onClick={() => setShowOrderForm(false)}>✕</Button>}>
          {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>}
          <form onSubmit={handleCreateOrder} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input id="orderNumber" label="Order Number" placeholder="e.g. PO-2026-001" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
            <div>
              <label htmlFor="productId" className="block text-sm font-medium text-gray-700 mb-1">Product</label>
              <select id="productId" value={productId} onChange={(e) => setProductId(e.target.value)} required className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Pilih product...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </div>
            <Input id="quantity" label="Quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            <Input id="unit" label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} required />
            <Input id="plannedDate" label="Planned Date" type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} required />
            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button variant="secondary" type="button" onClick={() => setShowOrderForm(false)}>Batal</Button>
              <Button type="submit" loading={formLoading}>Create Order</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Batch Form */}
      {showBatchForm && (
        <Card title="New Production Batch" action={<Button variant="ghost" size="sm" onClick={() => setShowBatchForm(false)}>✕</Button>}>
          {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>}
          <form onSubmit={handleCreateBatch} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input id="batchLot" label="Batch Lot Number" placeholder="e.g. FG-2026-001" value={batchLotNumber} onChange={(e) => setBatchLotNumber(e.target.value)} required />
            <div>
              <label htmlFor="batchOrderId" className="block text-sm font-medium text-gray-700 mb-1">Production Order</label>
              <select id="batchOrderId" value={batchOrderId} onChange={(e) => setBatchOrderId(e.target.value)} required className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Pilih order...</option>
                {orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').map((o) => <option key={o.id} value={o.id}>{o.orderNumber} — {o.product?.name || ''}</option>)}
              </select>
            </div>
            <Input id="batchQty" label="Batch Quantity" type="number" value={batchQuantity} onChange={(e) => setBatchQuantity(e.target.value)} required />
            <Input id="batchUnit" label="Unit" value={batchUnit} onChange={(e) => setBatchUnit(e.target.value)} required />
            <div>
              <label htmlFor="selectedLot" className="block text-sm font-medium text-gray-700 mb-1">Raw Material Lot (Approved)</label>
              <select id="selectedLot" value={selectedLotId} onChange={(e) => setSelectedLotId(e.target.value)} required className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Pilih lot...</option>
                {approvedLots.map((l) => <option key={l.id} value={l.id}>{l.lotNumber} — {l.material?.name || ''} ({l.quantity} {l.unit})</option>)}
              </select>
            </div>
            <Input id="lotQtyUsed" label="Qty Used" type="number" value={lotQtyUsed} onChange={(e) => setLotQtyUsed(e.target.value)} required />
            <Input id="lotUnit" label="Lot Unit" value={lotUnit} onChange={(e) => setLotUnit(e.target.value)} required />
            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button variant="secondary" type="button" onClick={() => setShowBatchForm(false)}>Batal</Button>
              <Button type="submit" loading={formLoading}>Create Batch</Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error} <Button variant="ghost" size="sm" className="ml-3" onClick={loadOrders}>Retry</Button>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Belum ada production order.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Order #</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Qty</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Planned Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono font-medium">{order.orderNumber}</td>
                    <td className="py-3 px-4">{order.product?.name || order.productId}</td>
                    <td className="py-3 px-4">{order.quantity} {order.unit}</td>
                    <td className="py-3 px-4"><Badge variant={statusVariant(order.status)}>{order.status}</Badge></td>
                    <td className="py-3 px-4 text-gray-600">{new Date(order.plannedDate).toLocaleDateString('id-ID')}</td>
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
