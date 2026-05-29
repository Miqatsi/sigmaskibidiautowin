import { prisma } from '../../../lib/prisma';

export interface SupplierContextData {
  suppliers: Array<{
    id: string;
    name: string;
    code: string;
    totalLots: number;
    failedLots: number;
    failureRate: number;
    lotNumbers: string[];
    failedLotNumbers: string[];
    affectedBatches: string[];
  }>;
  highestRisk: string | null;
  totalSuppliers: number;
}

/**
 * Retrieve supplier risk context from live database.
 * Calculates failure rates, identifies risky suppliers, links to affected production.
 */
export async function getSupplierContext(supplierName?: string): Promise<SupplierContextData> {
  const where: Record<string, unknown> = { deletedAt: null };
  if (supplierName) {
    where.name = { contains: supplierName, mode: 'insensitive' };
  }

  // Use simpler queries to avoid deep nesting issues with Prisma 7 adapter
  const suppliers = await prisma.supplier.findMany({
    where,
    select: { id: true, name: true, code: true },
  });

  const supplierStats = await Promise.all(suppliers.map(async (sup) => {
    const lots = await prisma.rawMaterialLot.findMany({
      where: { supplierId: sup.id, deletedAt: null },
      select: { id: true, lotNumber: true },
    });

    const lotIds = lots.map((l) => l.id);

    const failedQCCount = lotIds.length > 0
      ? await prisma.qCLog.count({
          where: { rawMaterialLotId: { in: lotIds }, result: 'FAIL', deletedAt: null },
        })
      : 0;

    const failedLotIds = lotIds.length > 0
      ? await prisma.qCLog.findMany({
          where: { rawMaterialLotId: { in: lotIds }, result: 'FAIL', deletedAt: null },
          select: { rawMaterialLotId: true },
          distinct: ['rawMaterialLotId'],
        })
      : [];

    const failedLotNumbers = lots
      .filter((l) => failedLotIds.some((f) => f.rawMaterialLotId === l.id))
      .map((l) => l.lotNumber);

    const batchLinks = lotIds.length > 0
      ? await prisma.productionBatchRawMaterial.findMany({
          where: { rawMaterialLotId: { in: lotIds } },
          include: { batch: { select: { lotNumber: true } } },
        })
      : [];

    const affectedBatches = [...new Set(batchLinks.map((b) => b.batch.lotNumber))];
    const totalLots = lots.length;
    const failedLots = failedLotIds.length;
    const failureRate = totalLots > 0 ? (failedLots / totalLots) * 100 : 0;

    return {
      id: sup.id,
      name: sup.name,
      code: sup.code,
      totalLots,
      failedLots,
      failureRate,
      lotNumbers: lots.map((l) => l.lotNumber),
      failedLotNumbers,
      affectedBatches,
    };
  }));

  const sorted = [...supplierStats].sort((a, b) => b.failureRate - a.failureRate);

  return {
    suppliers: sorted,
    highestRisk: sorted.length > 0 && sorted[0].failureRate > 0 ? sorted[0].name : null,
    totalSuppliers: suppliers.length,
  };
}
