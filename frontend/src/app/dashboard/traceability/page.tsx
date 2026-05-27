'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, statusVariant } from '@/components/ui/Badge';

interface QCEntry {
  id: string;
  type: string;
  result: string;
  notes: string | null;
  createdAt: string;
  inspector: string | null;
}

interface ProductionBatchEntry {
  lotNumber: string;
  status: string;
  product: { name: string; code: string } | null;
  startedAt: string;
  completedAt: string | null;
  rawMaterialsUsed: Array<{
    lotNumber: string;
    material: string;
    supplier: string;
    quantityUsed: number;
    unit: string;
  }>;
}

interface InventoryMovement {
  type: string;
  quantity: number;
  unit: string;
  location: string;
  reference: string | null;
  createdAt: string;
}

interface TraceResult {
  lotNumber: string;
  type: 'RAW_MATERIAL' | 'FINISHED_GOOD';
  material?: { name: string; code: string };
  supplier?: { name: string; code: string };
  receivedAt?: string;
  expiryDate?: string | null;
  status: string;
  qcHistory: QCEntry[];
  productionBatches: ProductionBatchEntry[];
  inventoryMovements: InventoryMovement[];
}

export default function TraceabilityPage() {
  const [lotNumber, setLotNumber] = useState('');
  const [result, setResult] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleTrace(e: React.FormEvent) {
    e.preventDefault();
    if (!lotNumber.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.get<{ success: boolean; data: TraceResult }>(
        `/traceability/${encodeURIComponent(lotNumber.trim())}`
      );
      if (res.success && res.data) {
        setResult(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lot tidak ditemukan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Traceability</h1>
        <p className="text-base text-gray-600 mt-1">
          Track lot history — forward and backward tracing
        </p>
      </div>

      {/* Search */}
      <Card>
        <form onSubmit={handleTrace} className="flex items-end gap-4">
          <div className="flex-1">
            <Input
              id="lotNumber"
              label="Lot Number"
              placeholder="Masukkan nomor lot (e.g. LOT-RM-001)"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
            />
          </div>
          <Button type="submit" loading={loading} size="md">
            🔍 Trace
          </Button>
        </form>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Lot Info */}
          <Card title="Lot Information">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Lot Number</p>
                <p className="font-mono font-medium">{result.lotNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium">{result.type === 'RAW_MATERIAL' ? 'Raw Material' : 'Finished Good'}</p>
              </div>
              {result.material && (
                <div>
                  <p className="text-sm text-gray-500">Material</p>
                  <p className="font-medium">{result.material.name} ({result.material.code})</p>
                </div>
              )}
              {result.supplier && (
                <div>
                  <p className="text-sm text-gray-500">Supplier</p>
                  <p className="font-medium">{result.supplier.name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={statusVariant(result.status)}>{result.status}</Badge>
              </div>
              {result.receivedAt && (
                <div>
                  <p className="text-sm text-gray-500">Received</p>
                  <p className="font-medium">{new Date(result.receivedAt).toLocaleDateString('id-ID')}</p>
                </div>
              )}
            </div>
          </Card>

          {/* QC History */}
          {result.qcHistory.length > 0 && (
            <Card title="QC History">
              <div className="space-y-2">
                {result.qcHistory.map((qc) => (
                  <div key={qc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Badge variant="info">{qc.type}</Badge>
                    <Badge variant={statusVariant(qc.result)}>{qc.result}</Badge>
                    <span className="text-sm text-gray-600 flex-1">{qc.notes || 'No notes'}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(qc.createdAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Production Batches */}
          {result.productionBatches.length > 0 && (
            <Card title="Production Batches">
              <div className="space-y-3">
                {result.productionBatches.map((batch, i) => (
                  <div key={i} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono font-medium">{batch.lotNumber}</span>
                      <Badge variant={statusVariant(batch.status)}>{batch.status}</Badge>
                      {batch.product && (
                        <span className="text-sm text-gray-600">
                          → {batch.product.name} ({batch.product.code})
                        </span>
                      )}
                    </div>
                    {batch.rawMaterialsUsed.length > 0 && (
                      <div className="mt-2 pl-4 border-l-2 border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-1">Raw Materials Used:</p>
                        {batch.rawMaterialsUsed.map((rm, j) => (
                          <div key={j} className="text-sm text-gray-600">
                            {rm.material} ({rm.lotNumber}) — {rm.quantityUsed} {rm.unit} from {rm.supplier}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Inventory Movements */}
          {result.inventoryMovements.length > 0 && (
            <Card title="Inventory Movements">
              <div className="space-y-2">
                {result.inventoryMovements.map((mv, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Badge variant={mv.type === 'IN' ? 'success' : mv.type === 'OUT' ? 'danger' : 'info'}>
                      {mv.type}
                    </Badge>
                    <span className="font-medium">{mv.quantity} {mv.unit}</span>
                    <span className="text-sm text-gray-600">@ {mv.location}</span>
                    {mv.reference && <span className="text-sm text-gray-500">({mv.reference})</span>}
                    <span className="text-sm text-gray-500 ml-auto">
                      {new Date(mv.createdAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Empty state for no downstream data */}
          {result.qcHistory.length === 0 && result.productionBatches.length === 0 && result.inventoryMovements.length === 0 && (
            <Card>
              <p className="text-center text-gray-500 py-4">
                No downstream traceability data found for this lot yet.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
