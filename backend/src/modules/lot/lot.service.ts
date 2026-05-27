import { prisma } from '../../lib/prisma';
import { CreateLotInput, LotStatusType } from './lot.schema';

/**
 * Create a new raw material lot (incoming goods).
 */
export async function createLot(data: CreateLotInput, userId: string) {
  return prisma.rawMaterialLot.create({
    data: {
      lotNumber: data.lotNumber,
      materialId: data.materialId,
      supplierId: data.supplierId,
      quantity: data.quantity,
      unit: data.unit,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      status: 'PENDING_QC',
      createdBy: userId,
      updatedBy: userId,
    },
    include: {
      material: { select: { id: true, name: true, code: true } },
      supplier: { select: { id: true, name: true, code: true } },
    },
  });
}

/**
 * Get all lots with filtering and pagination.
 */
export async function getLots(params: {
  page?: number;
  limit?: number;
  status?: LotStatusType;
  supplierId?: string;
  materialId?: string;
}) {
  const { page = 1, limit = 20, status, supplierId, materialId } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { deletedAt: null };
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;
  if (materialId) where.materialId = materialId;

  const [lots, total] = await Promise.all([
    prisma.rawMaterialLot.findMany({
      where,
      include: {
        material: { select: { id: true, name: true, code: true } },
        supplier: { select: { id: true, name: true, code: true } },
      },
      orderBy: { receivedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.rawMaterialLot.count({ where }),
  ]);

  return {
    data: lots,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Get a single lot by lotNumber (the natural key for manufacturing).
 */
export async function getLotByNumber(lotNumber: string) {
  return prisma.rawMaterialLot.findFirst({
    where: { lotNumber, deletedAt: null },
    include: {
      material: { select: { id: true, name: true, code: true, unit: true } },
      supplier: { select: { id: true, name: true, code: true } },
      qcLogs: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
      productionBatchLots: {
        include: {
          batch: { select: { id: true, lotNumber: true, status: true } },
        },
      },
    },
  });
}

/**
 * Get a single lot by ID.
 */
export async function getLotById(id: string) {
  return prisma.rawMaterialLot.findFirst({
    where: { id, deletedAt: null },
    include: {
      material: { select: { id: true, name: true, code: true, unit: true } },
      supplier: { select: { id: true, name: true, code: true } },
      qcLogs: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

/**
 * Update lot status. Returns old and new data for audit.
 * This is a critical operation — status transitions drive the manufacturing flow.
 */
export async function updateLotStatus(id: string, status: LotStatusType, userId: string) {
  const oldData = await prisma.rawMaterialLot.findFirst({ where: { id, deletedAt: null } });
  if (!oldData) return null;

  // Validate status transition
  const validTransitions: Record<string, string[]> = {
    PENDING_QC: ['APPROVED', 'REJECTED'],
    APPROVED: ['CONSUMED'],
    REJECTED: ['PENDING_QC'], // Allow re-inspection
    CONSUMED: [], // Terminal state
  };

  const allowed = validTransitions[oldData.status] || [];
  if (!allowed.includes(status)) {
    throw new Error(
      `Transisi status tidak valid: ${oldData.status} → ${status}. ` +
      `Status yang diizinkan: ${allowed.join(', ') || 'tidak ada (terminal state)'}`
    );
  }

  const updated = await prisma.rawMaterialLot.update({
    where: { id },
    data: {
      status,
      updatedBy: userId,
      version: { increment: 1 },
    },
    include: {
      material: { select: { id: true, name: true, code: true } },
      supplier: { select: { id: true, name: true, code: true } },
    },
  });

  return { oldData, newData: updated };
}
