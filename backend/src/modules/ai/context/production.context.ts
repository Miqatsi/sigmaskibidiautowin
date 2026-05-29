import { prisma } from '../../../lib/prisma';

export interface ProductionContextData {
  activeOrders: Array<{
    id: string;
    orderNumber: string;
    product: string;
    quantity: number;
    unit: string;
    status: string;
    plannedDate: string;
    batchCount: number;
    blockedReason: string | null;
  }>;
  blockedOrders: Array<{
    orderNumber: string;
    reason: string;
    product: string;
  }>;
  recentBatches: Array<{
    id: string;
    lotNumber: string;
    status: string;
    product: string;
    materialsUsed: string[];
  }>;
  totalOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  blockedCount: number;
}

/**
 * Retrieve production analysis context.
 * Identifies blocked orders, active batches, and dependencies.
 */
export async function getProductionContext(): Promise<ProductionContextData> {
  // Active/planned orders
  const orders = await prisma.productionOrder.findMany({
    where: { deletedAt: null, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
    include: {
      product: { select: { name: true, code: true } },
      batches: { where: { deletedAt: null }, select: { id: true, status: true } },
    },
    orderBy: { plannedDate: 'asc' },
  });

  // Check for lots pending QC (potential blockers)
  const pendingQCLots = await prisma.rawMaterialLot.count({
    where: { status: 'PENDING_QC', deletedAt: null },
  });

  // Check for approved lots available for production
  const approvedLots = await prisma.rawMaterialLot.count({
    where: { status: 'APPROVED', deletedAt: null },
  });

  const activeOrders = orders.map((order) => {
    // Determine if order is blocked
    let blockedReason: string | null = null;
    if (order.status === 'PLANNED' && approvedLots === 0) {
      blockedReason = pendingQCLots > 0
        ? `Waiting for QC approval (${pendingQCLots} lot(s) pending)`
        : 'No approved raw materials available';
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      product: `${order.product.name} (${order.product.code})`,
      quantity: order.quantity,
      unit: order.unit,
      status: order.status,
      plannedDate: order.plannedDate.toISOString(),
      batchCount: order.batches.length,
      blockedReason,
    };
  });

  const blockedOrders = activeOrders
    .filter((o) => o.blockedReason !== null)
    .map((o) => ({ orderNumber: o.orderNumber, reason: o.blockedReason!, product: o.product }));

  // Recent batches with materials
  const recentBatches = await prisma.productionBatch.findMany({
    where: { deletedAt: null },
    include: {
      order: { include: { product: { select: { name: true } } } },
      rawMaterials: {
        include: { rawMaterialLot: { select: { lotNumber: true, material: { select: { name: true } } } } },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 10,
  });

  // Counts
  const [totalOrders, inProgressOrders, completedOrders] = await Promise.all([
    prisma.productionOrder.count({ where: { deletedAt: null } }),
    prisma.productionOrder.count({ where: { status: 'IN_PROGRESS', deletedAt: null } }),
    prisma.productionOrder.count({ where: { status: 'COMPLETED', deletedAt: null } }),
  ]);

  return {
    activeOrders,
    blockedOrders,
    recentBatches: recentBatches.map((b) => ({
      id: b.id,
      lotNumber: b.lotNumber,
      status: b.status,
      product: b.order?.product?.name || 'Unknown',
      materialsUsed: b.rawMaterials.map((rm) => `${rm.rawMaterialLot.material.name} (${rm.rawMaterialLot.lotNumber})`),
    })),
    totalOrders,
    inProgressOrders,
    completedOrders,
    blockedCount: blockedOrders.length,
  };
}
