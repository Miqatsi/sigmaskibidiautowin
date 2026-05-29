'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

// ============================================================
// INTERFACES
// ============================================================

interface ScheduleItem {
  orderId: string;
  orderNumber: string;
  productName: string;
  productCode: string;
  quantity: number;
  unit: string;
  plannedDate: string;
  suggestedSlot: string;
  priority: number;
  aiReasoning: string;
  materialStatus: 'AVAILABLE' | 'LOW' | 'UNAVAILABLE';
  estimatedDuration: string;
}

interface ScheduleResult {
  success: boolean;
  schedule: ScheduleItem[];
  warnings: string[];
  summary: {
    totalOrders: number;
    scheduledOrders: number;
    blockedOrders: number;
    estimatedCompletionDate: string;
  };
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  quantity: number;
  unit: string;
  status: string;
  plannedDate: string;
  product: { name: string; code: string };
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function MaterialBadge({ status }: { status: string }) {
  const variant = status === 'AVAILABLE' ? 'success' : status === 'LOW' ? 'warning' : 'danger';
  return <Badge variant={variant}>{status}</Badge>;
}

function PriorityBadge({ priority }: { priority: number }) {
  if (priority <= 2) return <Badge variant="danger">P{priority}</Badge>;
  if (priority <= 5) return <Badge variant="warning">P{priority}</Badge>;
  return <Badge variant="neutral">P{priority}</Badge>;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function PPICBoardPage() {
  const [unscheduled, setUnscheduled] = useState<ProductionOrder[]>([]);
  const [inProgress, setInProgress] = useState<ProductionOrder[]>([]);
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      const [plannedRes, progressRes] = await Promise.all([
        api.get<{ success: boolean; data: ProductionOrder[] }>('/production/orders?status=PLANNED&limit=50'),
        api.get<{ success: boolean; data: ProductionOrder[] }>('/production/orders?status=IN_PROGRESS&limit=50'),
      ]);
      if (plannedRes.success) setUnscheduled(plannedRes.data || []);
      if (progressRes.success) setInProgress(progressRes.data || []);
    } catch {
      setError('Gagal memuat data production orders.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateSchedule() {
    setGenerating(true);
    setError('');
    setSuccessMsg('');
    setSchedule(null);

    try {
      const res = await api.post<{ success: boolean; data: ScheduleResult }>('/ai/schedule', {});
      if (res.success && res.data) {
        setSchedule(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI scheduling gagal.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove() {
    if (!schedule || schedule.schedule.length === 0) return;

    setApproving(true);
    setError('');
    setSuccessMsg('');

    try {
      const orderIds = schedule.schedule
        .filter(s => s.materialStatus !== 'UNAVAILABLE')
        .map(s => s.orderId);

      const res = await api.post<{ success: boolean; message: string }>('/ai/schedule/approve', { orderIds });
      if (res.success) {
        setSuccessMsg(res.message || `${orderIds.length} orders pushed to production floor.`);
        setSchedule(null);
        await loadOrders();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval gagal.');
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PPIC Scheduling Board</h1>
          <p className="text-base text-gray-600 mt-1">
            AI-assisted production planning & scheduling
          </p>
        </div>
        <Button
          size="lg"
          onClick={handleGenerateSchedule}
          loading={generating}
          disabled={generating || unscheduled.length === 0}
        >
          ✨ Generate AI Schedule
        </Button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}
      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">{successMsg}</div>
      )}

      {/* Three-column board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1: Unscheduled Orders */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">
              Unscheduled ({unscheduled.length})
            </h2>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 border-3 border-gray-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : unscheduled.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No pending orders</p>
            ) : (
              unscheduled.map((order) => (
                <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-base">{order.orderNumber}</span>
                    <Badge variant="neutral">PLANNED</Badge>
                  </div>
                  <p className="font-medium text-gray-900">{order.product?.name}</p>
                  <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
                    <span>{order.quantity} {order.unit}</span>
                    <span>Due: {new Date(order.plannedDate).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: AI Suggested Schedule */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              AI Suggested Schedule
            </h2>
          </div>

          {generating ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
              <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-blue-700 font-medium">AI is analyzing orders...</p>
              <p className="text-blue-600 text-sm mt-1">Checking material availability & optimizing schedule</p>
            </div>
          ) : schedule ? (
            <div className="space-y-3">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-blue-600">Total:</span>{' '}
                    <strong>{schedule.summary.totalOrders}</strong>
                  </div>
                  <div>
                    <span className="text-blue-600">Scheduled:</span>{' '}
                    <strong>{schedule.summary.scheduledOrders}</strong>
                  </div>
                  <div>
                    <span className="text-blue-600">Blocked:</span>{' '}
                    <strong className="text-red-600">{schedule.summary.blockedOrders}</strong>
                  </div>
                  <div>
                    <span className="text-blue-600">Complete by:</span>{' '}
                    <strong>{schedule.summary.estimatedCompletionDate}</strong>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {schedule.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  {schedule.warnings.map((w, i) => (
                    <p key={i} className="text-yellow-800 text-sm">{w}</p>
                  ))}
                </div>
              )}

              {/* Schedule items */}
              {schedule.schedule.map((item) => (
                <div
                  key={item.orderId}
                  className={`bg-white border rounded-lg p-4 shadow-sm ${
                    item.materialStatus === 'UNAVAILABLE'
                      ? 'border-red-300 opacity-60'
                      : 'border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      <span className="font-mono font-bold">{item.orderNumber}</span>
                    </div>
                    <MaterialBadge status={item.materialStatus} />
                  </div>
                  <p className="font-medium text-gray-900">{item.productName}</p>
                  <div className="flex items-center justify-between mt-1 text-sm text-gray-600">
                    <span>{item.quantity} {item.unit}</span>
                    <span>⏱ {item.estimatedDuration}</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="text-blue-600 font-medium">Slot:</span>{' '}
                    <span className="font-mono">{item.suggestedSlot}</span>
                  </div>
                  {/* AI Reasoning */}
                  <div className="mt-2 bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500 font-medium">🤖 AI Reasoning:</p>
                    <p className="text-sm text-gray-700">{item.aiReasoning}</p>
                  </div>
                </div>
              ))}

              {/* Approve button */}
              {schedule.schedule.length > 0 && (
                <Button
                  size="lg"
                  className="w-full mt-4"
                  onClick={handleApprove}
                  loading={approving}
                  disabled={approving}
                >
                  ✅ Approve & Push to Floor
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 border-dashed rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">No schedule generated yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Click &quot;Generate AI Schedule&quot; to optimize
              </p>
            </div>
          )}
        </div>

        {/* Column 3: In Progress */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              In Progress ({inProgress.length})
            </h2>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 border-3 border-green-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : inProgress.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No orders in progress</p>
            ) : (
              inProgress.map((order) => (
                <div key={order.id} className="bg-white border border-green-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-base">{order.orderNumber}</span>
                    <Badge variant="success">IN PROGRESS</Badge>
                  </div>
                  <p className="font-medium text-gray-900">{order.product?.name}</p>
                  <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
                    <span>{order.quantity} {order.unit}</span>
                    <span>Due: {new Date(order.plannedDate).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
