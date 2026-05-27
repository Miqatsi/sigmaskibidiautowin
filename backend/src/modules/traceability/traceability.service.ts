import { prisma } from '../../lib/prisma';

export interface TraceabilityResult {
  lotNumber: string;
  type: 'RAW_MATERIAL' | 'FINISHED_GOOD';
  material?: { name: string; code: string };
  supplier?: { name: string; code: string };
  receivedAt?: string;
  expiryDate?: string | null;
  status: string;
  qcHistory: Array<{
    id: string;
    type: string;
    result: string;
    notes: string | null;
    createdAt: string;
    inspector: string | null;
  }>;
  productionBatches: Array<{
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
  }>;
  inventoryMovements: Array<{
    type: string;
    quantity: number;
    unit: string;
    location: string;
    reference: string | null;
    createdAt: string;
  }>;
}

/**
 * Trace a raw material lot forward:
 * Lot → QC → Production Batches → Inventory
 */
async function traceRawMaterialLot(lotNumber: string): Promise<TraceabilityResult | null> {
  const lot = await prisma.rawMaterialLot.findFirst({
    where: { lotNumber },
    include: {
      material: { select: { name: true, code: true } },
      supplier: { select: { name: true, code: true } },
      qcLogs: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, type: true, result: true, notes: true, createdAt: true, createdBy: true },
      },
      productionBatchLots: {
        include: {
          batch: {
            include: {
              order: { include: { product: { select: { name: true, code: true } } } },
              rawMaterials: {
                include: {
                  rawMaterialLot: {
                    select: { lotNumber: true, material: { select: { name: true } }, supplier: { select: { name: true } } },
                  },
                },
              },
              inventoryTransactions: {
                where: { deletedAt: null },
                include: { storageLocation: { select: { name: true, code: true } } },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!lot) return null;

  return {
    lotNumber: lot.lotNumber,
    type: 'RAW_MATERIAL',
    material: lot.material,
    supplier: lot.supplier,
    receivedAt: lot.receivedAt.toISOString(),
    expiryDate: lot.expiryDate?.toISOString() || null,
    status: lot.status,
    qcHistory: lot.qcLogs.map((qc) => ({
      id: qc.id,
      type: qc.type,
      result: qc.result,
      notes: qc.notes,
      createdAt: qc.createdAt.toISOString(),
      inspector: qc.createdBy,
    })),
    productionBatches: lot.productionBatchLots.map((pbl) => ({
      lotNumber: pbl.batch.lotNumber,
      status: pbl.batch.status,
      product: pbl.batch.order?.product || null,
      startedAt: pbl.batch.startedAt.toISOString(),
      completedAt: pbl.batch.completedAt?.toISOString() || null,
      rawMaterialsUsed: pbl.batch.rawMaterials.map((rm) => ({
        lotNumber: rm.rawMaterialLot.lotNumber,
        material: rm.rawMaterialLot.material.name,
        supplier: rm.rawMaterialLot.supplier.name,
        quantityUsed: rm.quantityUsed,
        unit: rm.unit,
      })),
    })),
    inventoryMovements: lot.productionBatchLots.flatMap((pbl) =>
      pbl.batch.inventoryTransactions.map((tx) => ({
        type: tx.type,
        quantity: tx.quantity,
        unit: tx.unit,
        location: tx.storageLocation.name,
        reference: tx.reference,
        createdAt: tx.createdAt.toISOString(),
      }))
    ),
  };
}

/**
 * Trace a production batch (finished good) backward:
 * Batch → Raw Materials → Suppliers → QC
 */
async function traceProductionBatch(lotNumber: string): Promise<TraceabilityResult | null> {
  const batch = await prisma.productionBatch.findFirst({
    where: { lotNumber },
    include: {
      order: { include: { product: { select: { name: true, code: true } } } },
      qcLogs: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, type: true, result: true, notes: true, createdAt: true, createdBy: true },
      },
      rawMaterials: {
        include: {
          rawMaterialLot: {
            include: {
              material: { select: { name: true, code: true } },
              supplier: { select: { name: true, code: true } },
              qcLogs: {
                where: { deletedAt: null },
                select: { id: true, type: true, result: true, notes: true, createdAt: true, createdBy: true },
              },
            },
          },
        },
      },
      inventoryTransactions: {
        where: { deletedAt: null },
        include: { storageLocation: { select: { name: true, code: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!batch) return null;

  return {
    lotNumber: batch.lotNumber,
    type: 'FINISHED_GOOD',
    status: batch.status,
    qcHistory: batch.qcLogs.map((qc) => ({
      id: qc.id,
      type: qc.type,
      result: qc.result,
      notes: qc.notes,
      createdAt: qc.createdAt.toISOString(),
      inspector: qc.createdBy,
    })),
    productionBatches: [{
      lotNumber: batch.lotNumber,
      status: batch.status,
      product: batch.order?.product || null,
      startedAt: batch.startedAt.toISOString(),
      completedAt: batch.completedAt?.toISOString() || null,
      rawMaterialsUsed: batch.rawMaterials.map((rm) => ({
        lotNumber: rm.rawMaterialLot.lotNumber,
        material: rm.rawMaterialLot.material.name,
        supplier: rm.rawMaterialLot.supplier.name,
        quantityUsed: rm.quantityUsed,
        unit: rm.unit,
      })),
    }],
    inventoryMovements: batch.inventoryTransactions.map((tx) => ({
      type: tx.type,
      quantity: tx.quantity,
      unit: tx.unit,
      location: tx.storageLocation.name,
      reference: tx.reference,
      createdAt: tx.createdAt.toISOString(),
    })),
  };
}

/**
 * Main traceability function.
 * Searches both raw material lots and production batches by lot number.
 */
export async function traceLot(lotNumber: string): Promise<TraceabilityResult | null> {
  // Try raw material lot first
  const rawResult = await traceRawMaterialLot(lotNumber);
  if (rawResult) return rawResult;

  // Try production batch
  const batchResult = await traceProductionBatch(lotNumber);
  if (batchResult) return batchResult;

  return null;
}
