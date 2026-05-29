import { prisma } from '../../../lib/prisma';

export interface QCContextData {
  lot: {
    lotNumber: string;
    material: string;
    supplier: string;
    status: string;
    quantity: number;
    unit: string;
  } | null;
  qcHistory: Array<{
    id: string;
    type: string;
    result: string;
    notes: string | null;
    date: string;
  }>;
  supplierHistory: {
    supplierName: string;
    totalLotsFromSupplier: number;
    failedLotsFromSupplier: number;
    supplierFailureRate: number;
  } | null;
  recentFailures: Array<{
    lotNumber: string;
    supplier: string;
    date: string;
    notes: string | null;
  }>;
  totalInspections: number;
  totalFailures: number;
  overallFailureRate: number;
}

/**
 * Retrieve QC analysis context.
 * If lotNumber provided, gets specific lot QC history + supplier history.
 * Otherwise, gets system-wide QC stats.
 */
export async function getQCContext(lotNumber?: string): Promise<QCContextData> {
  let lotData: QCContextData['lot'] = null;
  let qcHistory: QCContextData['qcHistory'] = [];
  let supplierHistory: QCContextData['supplierHistory'] = null;

  if (lotNumber) {
    const lot = await prisma.rawMaterialLot.findFirst({
      where: { lotNumber: { contains: lotNumber, mode: 'insensitive' }, deletedAt: null },
      include: {
        material: { select: { name: true, code: true } },
        supplier: {
          select: {
            name: true,
            rawMaterialLots: {
              where: { deletedAt: null },
              include: { qcLogs: { where: { deletedAt: null }, select: { result: true } } },
            },
          },
        },
        qcLogs: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { id: true, type: true, result: true, notes: true, createdAt: true },
        },
      },
    });

    if (lot) {
      lotData = {
        lotNumber: lot.lotNumber,
        material: `${lot.material.name} (${lot.material.code})`,
        supplier: lot.supplier.name,
        status: lot.status,
        quantity: lot.quantity,
        unit: lot.unit,
      };

      qcHistory = lot.qcLogs.map((qc) => ({
        id: qc.id,
        type: qc.type,
        result: qc.result,
        notes: qc.notes,
        date: qc.createdAt.toISOString(),
      }));

      // Supplier history for this specific supplier
      const totalFromSupplier = lot.supplier.rawMaterialLots.length;
      const failedFromSupplier = lot.supplier.rawMaterialLots.filter(
        (l) => l.qcLogs.some((qc) => qc.result === 'FAIL')
      ).length;

      supplierHistory = {
        supplierName: lot.supplier.name,
        totalLotsFromSupplier: totalFromSupplier,
        failedLotsFromSupplier: failedFromSupplier,
        supplierFailureRate: totalFromSupplier > 0 ? (failedFromSupplier / totalFromSupplier) * 100 : 0,
      };
    }
  }

  // System-wide QC stats
  const [totalInspections, totalFailures] = await Promise.all([
    prisma.qCLog.count({ where: { deletedAt: null } }),
    prisma.qCLog.count({ where: { result: 'FAIL', deletedAt: null } }),
  ]);

  // Recent failures
  const failures = await prisma.qCLog.findMany({
    where: { result: 'FAIL', deletedAt: null },
    include: {
      rawMaterialLot: { select: { lotNumber: true, supplier: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const recentFailures = failures.map((f) => ({
    lotNumber: f.rawMaterialLot?.lotNumber || 'N/A',
    supplier: f.rawMaterialLot?.supplier?.name || 'N/A',
    date: f.createdAt.toISOString(),
    notes: f.notes,
  }));

  return {
    lot: lotData,
    qcHistory,
    supplierHistory,
    recentFailures,
    totalInspections,
    totalFailures,
    overallFailureRate: totalInspections > 0 ? (totalFailures / totalInspections) * 100 : 0,
  };
}
