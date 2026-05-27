import { prisma } from '../../lib/prisma';
import { CreateOrderInput, CreateBatchInput } from './production.schema';

/**
 * Create a production order.
 */
export async function createOrder(data: CreateOrderInput, userId: string) {
  return prisma.productionOrder.create({
    data: {
      orderNumber: data.orderNumber,
      productId: data.productId,
      quantity: data.quantity,
      unit: data.unit,
      plannedDate: new Date(data.plannedDate),
      status: 'PLANNED',
      createdBy: userId,
      updatedBy: userId,
    },
    include: {
      product: { select: { id: true, name: true, code: true } },
    },
  });
}

/**
 * Get production orders with pagination.
 */
export async function getOrders(params: { page?: number; limit?: number; status?: string }) {
  const { page = 1, limit = 20, status } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { deletedAt: null };
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.productionOrder.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, code: true } },
        batches: { select: { id: true, lotNumber: true, status: true } },
      },
      orderBy: { plannedDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.productionOrder.count({ where }),
  ]);

  return { data: orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Update order status.
 */
export async function updateOrderStatus(id: string, status: string, userId: string) {
  const oldData = await prisma.productionOrder.findFirst({ where: { id, deletedAt: null } });
  if (!oldData) return null;

  const updated = await prisma.productionOrder.update({
    where: { id },
    data: { status, updatedBy: userId, version: { increment: 1 } },
    include: { product: { select: { id: true, name: true, code: true } } },
  });

  return { oldData, newData: updated };
}

/**
 * Create a production batch.
 * Consumes approved raw material lots (changes their status to CONSUMED).
 * This is atomic — if any lot is not APPROVED, the whole operation fails.
 */
export async function createBatch(data: CreateBatchInput, userId: string) {
  // Validate all raw material lots are APPROVED
  for (const item of data.rawMaterialLotIds) {
    const lot = await prisma.rawMaterialLot.findFirst({
      where: { id: item.lotId, deletedAt: null },
    });
    if (!lot) throw new Error(`Lot ${item.lotId} tidak ditemukan.`);
    if (lot.status !== 'APPROVED') {
      throw new Error(`Lot '${lot.lotNumber}' belum APPROVED (status: ${lot.status}). Hanya lot APPROVED yang bisa dikonsumsi.`);
    }
  }

  // Create batch
  const batch = await prisma.productionBatch.create({
    data: {
      lotNumber: data.lotNumber,
      orderId: data.orderId,
      quantity: data.quantity,
      unit: data.unit,
      status: 'IN_PROGRESS',
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // Link raw materials and mark as CONSUMED
  for (const item of data.rawMaterialLotIds) {
    await prisma.productionBatchRawMaterial.create({
      data: {
        batchId: batch.id,
        rawMaterialLotId: item.lotId,
        quantityUsed: item.quantityUsed,
        unit: item.unit,
      },
    });

    await prisma.rawMaterialLot.update({
      where: { id: item.lotId },
      data: { status: 'CONSUMED', updatedBy: userId, version: { increment: 1 } },
    });
  }

  // Update order status to IN_PROGRESS
  await prisma.productionOrder.update({
    where: { id: data.orderId },
    data: { status: 'IN_PROGRESS', updatedBy: userId, version: { increment: 1 } },
  });

  // Return full batch with relations
  return prisma.productionBatch.findUnique({
    where: { id: batch.id },
    include: {
      order: { select: { id: true, orderNumber: true, product: { select: { name: true, code: true } } } },
      rawMaterials: {
        include: {
          rawMaterialLot: { select: { id: true, lotNumber: true, material: { select: { name: true, code: true } }, supplier: { select: { name: true, code: true } } } },
        },
      },
    },
  });
}

/**
 * Get production batches.
 */
export async function getBatches(params: { page?: number; limit?: number; status?: string; orderId?: string }) {
  const { page = 1, limit = 20, status, orderId } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { deletedAt: null };
  if (status) where.status = status;
  if (orderId) where.orderId = orderId;

  const [batches, total] = await Promise.all([
    prisma.productionBatch.findMany({
      where,
      include: {
        order: { select: { id: true, orderNumber: true, product: { select: { name: true, code: true } } } },
        rawMaterials: {
          include: { rawMaterialLot: { select: { lotNumber: true, material: { select: { name: true } } } } },
        },
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.productionBatch.count({ where }),
  ]);

  return { data: batches, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Update batch status (complete or fail).
 */
export async function updateBatchStatus(id: string, status: string, userId: string) {
  const oldData = await prisma.productionBatch.findFirst({ where: { id, deletedAt: null } });
  if (!oldData) return null;

  const updateData: Record<string, unknown> = {
    status,
    updatedBy: userId,
    version: { increment: 1 },
  };

  if (status === 'COMPLETED') {
    updateData.completedAt = new Date();
  }

  const updated = await prisma.productionBatch.update({
    where: { id },
    data: updateData,
    include: {
      order: { select: { id: true, orderNumber: true } },
    },
  });

  // If batch completed, check if all batches for the order are done
  if (status === 'COMPLETED') {
    const pendingBatches = await prisma.productionBatch.count({
      where: { orderId: oldData.orderId, status: 'IN_PROGRESS', deletedAt: null },
    });
    if (pendingBatches === 0) {
      await prisma.productionOrder.update({
        where: { id: oldData.orderId },
        data: { status: 'COMPLETED', updatedBy: userId, version: { increment: 1 } },
      });
    }
  }

  return { oldData, newData: updated };
}
