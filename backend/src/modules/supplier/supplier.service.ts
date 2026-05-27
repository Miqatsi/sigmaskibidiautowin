import { prisma } from '../../lib/prisma';
import { CreateSupplierInput, UpdateSupplierInput } from './supplier.schema';

/**
 * Create a new supplier.
 */
export async function createSupplier(data: CreateSupplierInput, userId: string) {
  return prisma.supplier.create({
    data: {
      ...data,
      createdBy: userId,
      updatedBy: userId,
    },
  });
}

/**
 * Get all active suppliers with pagination.
 */
export async function getSuppliers(page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.supplier.count({ where: { deletedAt: null } }),
  ]);

  return {
    data: suppliers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a single supplier by ID.
 */
export async function getSupplierById(id: string) {
  return prisma.supplier.findFirst({
    where: { id, deletedAt: null },
    include: {
      rawMaterialLots: {
        where: { deletedAt: null },
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

/**
 * Update a supplier. Returns old and new data for audit.
 */
export async function updateSupplier(id: string, data: UpdateSupplierInput, userId: string) {
  const oldData = await prisma.supplier.findUnique({ where: { id } });
  if (!oldData || oldData.deletedAt) {
    return null;
  }

  const updated = await prisma.supplier.update({
    where: { id },
    data: {
      ...data,
      updatedBy: userId,
      version: { increment: 1 },
    },
  });

  return { oldData, newData: updated };
}

/**
 * Soft-delete a supplier. Manufacturing keeps history.
 */
export async function deleteSupplier(id: string, userId: string) {
  const existing = await prisma.supplier.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return null;

  await prisma.supplier.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedBy: userId,
      version: { increment: 1 },
    },
  });

  return existing;
}
