import { prisma } from '../../lib/prisma';
import { CreateQCInput, UpdateQCInput, QCResultValue } from './qc.schema';

/**
 * Map QC result to lot status.
 * PASS → APPROVED, FAIL → REJECTED, CONDITIONAL → stays PENDING_QC
 */
function mapResultToLotStatus(result: QCResultValue): string | null {
  switch (result) {
    case 'PASS': return 'APPROVED';
    case 'FAIL': return 'REJECTED';
    case 'CONDITIONAL': return null; // No auto-transition
  }
}

/**
 * Create QC log and atomically update lot status if applicable.
 * Uses Prisma transaction to ensure consistency.
 */
export async function createQCLog(data: CreateQCInput, userId: string) {
  const newLotStatus = data.rawMaterialLotId ? mapResultToLotStatus(data.result) : null;

  // Validate lot exists and is in PENDING_QC state
  if (data.rawMaterialLotId && newLotStatus) {
    const lot = await prisma.rawMaterialLot.findFirst({
      where: { id: data.rawMaterialLotId, deletedAt: null },
    });
    if (!lot) throw new Error('Lot tidak ditemukan.');
    if (lot.status !== 'PENDING_QC') {
      throw new Error(`Lot sudah dalam status '${lot.status}'. QC hanya bisa dilakukan pada lot PENDING_QC.`);
    }
  }

  // Atomic transaction: create QC + update lot status + audit
  const qcLog = await prisma.qCLog.create({
    data: {
      type: data.type,
      result: data.result,
      rawMaterialLotId: data.rawMaterialLotId || null,
      batchId: data.batchId || null,
      notes: data.notes || null,
      createdBy: userId,
      updatedBy: userId,
    },
    include: {
      rawMaterialLot: {
        select: { id: true, lotNumber: true, status: true },
      },
      batch: {
        select: { id: true, lotNumber: true, status: true },
      },
    },
  });

  // Update lot status if QC result maps to a status change
  if (data.rawMaterialLotId && newLotStatus) {
    await prisma.rawMaterialLot.update({
      where: { id: data.rawMaterialLotId },
      data: {
        status: newLotStatus,
        updatedBy: userId,
        version: { increment: 1 },
      },
    });
  }

  return qcLog;
}

/**
 * Get QC logs with filtering and pagination.
 */
export async function getQCLogs(params: {
  page?: number;
  limit?: number;
  type?: string;
  result?: string;
  rawMaterialLotId?: string;
  batchId?: string;
}) {
  const { page = 1, limit = 20, type, result, rawMaterialLotId, batchId } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { deletedAt: null };
  if (type) where.type = type;
  if (result) where.result = result;
  if (rawMaterialLotId) where.rawMaterialLotId = rawMaterialLotId;
  if (batchId) where.batchId = batchId;

  const [logs, total] = await Promise.all([
    prisma.qCLog.findMany({
      where,
      include: {
        rawMaterialLot: { select: { id: true, lotNumber: true, status: true } },
        batch: { select: { id: true, lotNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.qCLog.count({ where }),
  ]);

  return {
    data: logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Get single QC log by ID.
 */
export async function getQCLogById(id: string) {
  return prisma.qCLog.findFirst({
    where: { id, deletedAt: null },
    include: {
      rawMaterialLot: {
        select: { id: true, lotNumber: true, status: true, material: { select: { name: true, code: true } } },
      },
      batch: { select: { id: true, lotNumber: true, status: true } },
      sampleDispatches: { where: { deletedAt: null } },
    },
  });
}

/**
 * Update QC log (e.g., change result after re-inspection).
 */
export async function updateQCLog(id: string, data: UpdateQCInput, userId: string) {
  const oldData = await prisma.qCLog.findFirst({ where: { id, deletedAt: null } });
  if (!oldData) return null;

  const updated = await prisma.qCLog.update({
    where: { id },
    data: {
      ...data,
      updatedBy: userId,
      version: { increment: 1 },
    },
    include: {
      rawMaterialLot: { select: { id: true, lotNumber: true, status: true } },
      batch: { select: { id: true, lotNumber: true, status: true } },
    },
  });

  // If result changed and linked to a lot, update lot status
  if (data.result && oldData.rawMaterialLotId) {
    const newLotStatus = mapResultToLotStatus(data.result);
    if (newLotStatus) {
      await prisma.rawMaterialLot.update({
        where: { id: oldData.rawMaterialLotId },
        data: { status: newLotStatus, updatedBy: userId, version: { increment: 1 } },
      });
    }
  }

  return { oldData, newData: updated };
}
