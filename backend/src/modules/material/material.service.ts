import { prisma } from '../../lib/prisma';
import { CreateMaterialInput, UpdateMaterialInput } from './material.schema';

export async function createMaterial(data: CreateMaterialInput, userId: string) {
  return prisma.rawMaterial.create({
    data: {
      ...data,
      createdBy: userId,
      updatedBy: userId,
    },
  });
}

export async function getMaterials(page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  const [materials, total] = await Promise.all([
    prisma.rawMaterial.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.rawMaterial.count({ where: { deletedAt: null } }),
  ]);

  return {
    data: materials,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getMaterialById(id: string) {
  return prisma.rawMaterial.findFirst({
    where: { id, deletedAt: null },
    include: {
      lots: {
        where: { deletedAt: null },
        take: 20,
        orderBy: { receivedAt: 'desc' },
      },
    },
  });
}

export async function updateMaterial(id: string, data: UpdateMaterialInput, userId: string) {
  const oldData = await prisma.rawMaterial.findFirst({ where: { id, deletedAt: null } });
  if (!oldData) return null;

  const updated = await prisma.rawMaterial.update({
    where: { id },
    data: { ...data, updatedBy: userId, version: { increment: 1 } },
  });

  return { oldData, newData: updated };
}

export async function deleteMaterial(id: string, userId: string) {
  const existing = await prisma.rawMaterial.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return null;

  await prisma.rawMaterial.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: userId, version: { increment: 1 } },
  });

  return existing;
}
