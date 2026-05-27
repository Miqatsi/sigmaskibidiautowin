import { prisma } from '../../lib/prisma';
import { CreateTransactionInput } from './inventory.schema';

/**
 * Create an inventory transaction (ledger entry).
 * This is append-only — never update or delete transactions.
 */
export async function createTransaction(data: CreateTransactionInput, userId: string) {
  // Validate storage location exists
  const location = await prisma.storageLocation.findFirst({
    where: { id: data.storageLocationId, deletedAt: null },
  });
  if (!location) throw new Error('Storage location tidak ditemukan.');

  // Validate batch exists if provided
  if (data.batchId) {
    const batch = await prisma.productionBatch.findFirst({
      where: { id: data.batchId, deletedAt: null },
    });
    if (!batch) throw new Error('Production batch tidak ditemukan.');
  }

  return prisma.inventoryTransaction.create({
    data: {
      type: data.type,
      storageLocationId: data.storageLocationId,
      batchId: data.batchId || null,
      quantity: data.quantity,
      unit: data.unit,
      reference: data.reference || null,
      createdBy: userId,
      updatedBy: userId,
    },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true, warehouse: { select: { name: true } } },
      },
      batch: { select: { id: true, lotNumber: true } },
    },
  });
}

/**
 * Get transaction history with filters.
 */
export async function getTransactions(params: {
  page?: number;
  limit?: number;
  type?: string;
  storageLocationId?: string;
  batchId?: string;
}) {
  const { page = 1, limit = 20, type, storageLocationId, batchId } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { deletedAt: null };
  if (type) where.type = type;
  if (storageLocationId) where.storageLocationId = storageLocationId;
  if (batchId) where.batchId = batchId;

  const [transactions, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      include: {
        storageLocation: { select: { id: true, name: true, code: true } },
        batch: { select: { id: true, lotNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);

  return { data: transactions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Get current stock balance for a storage location (reconstructed from ledger).
 */
export async function getStockBalance(storageLocationId: string) {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { storageLocationId, deletedAt: null },
    select: { quantity: true, unit: true, type: true, batchId: true },
  });

  // Aggregate by batch
  const balanceByBatch: Record<string, { quantity: number; unit: string; batchId: string | null }> = {};

  for (const tx of transactions) {
    const key = tx.batchId || '__unlinked__';
    if (!balanceByBatch[key]) {
      balanceByBatch[key] = { quantity: 0, unit: tx.unit, batchId: tx.batchId };
    }
    balanceByBatch[key].quantity += tx.quantity;
  }

  return Object.values(balanceByBatch).filter((b) => b.quantity !== 0);
}
