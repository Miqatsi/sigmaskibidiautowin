import { prisma } from '../../../lib/prisma';

export interface InventoryContextData {
  locations: Array<{
    id: string;
    name: string;
    code: string;
    totalMovements: number;
    netQuantity: number;
    unit: string;
    hasExpiredLots: boolean;
    recentActivity: Array<{ type: string; quantity: number; date: string; batch: string | null }>;
  }>;
  vulnerableInventory: Array<{
    location: string;
    reason: string;
    riskScore: number;
  }>;
  totalTransactions: number;
  recentShipments: number;
}

/**
 * Retrieve inventory risk context.
 * Identifies vulnerable inventory based on movement patterns and lot status.
 */
export async function getInventoryContext(): Promise<InventoryContextData> {
  const locations = await prisma.storageLocation.findMany({
    where: { deletedAt: null },
    include: {
      transactions: {
        where: { deletedAt: null },
        include: { batch: { select: { lotNumber: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const locationData = locations.map((loc) => {
    const netQuantity = loc.transactions.reduce((sum, tx) => sum + tx.quantity, 0);
    const unit = loc.transactions[0]?.unit || 'unit';
    const recentActivity = loc.transactions.slice(0, 5).map((tx) => ({
      type: tx.type,
      quantity: tx.quantity,
      date: tx.createdAt.toISOString(),
      batch: tx.batch?.lotNumber || null,
    }));

    // Check for failed batches in this location
    const hasExpiredLots = loc.transactions.some(
      (tx) => tx.batch?.status === 'FAILED'
    );

    return {
      id: loc.id,
      name: loc.name,
      code: loc.code,
      totalMovements: loc.transactions.length,
      netQuantity,
      unit,
      hasExpiredLots,
      recentActivity,
    };
  });

  // Identify vulnerable inventory
  const vulnerableInventory = locationData
    .filter((loc) => loc.hasExpiredLots || loc.netQuantity < 0)
    .map((loc) => ({
      location: loc.name,
      reason: loc.hasExpiredLots ? 'Contains lots from failed batches' : 'Negative stock balance detected',
      riskScore: loc.hasExpiredLots ? 80 : 60,
    }));

  const totalTransactions = await prisma.inventoryTransaction.count({ where: { deletedAt: null } });
  const recentShipments = await prisma.inventoryTransaction.count({
    where: { type: { in: ['SHIP', 'OUT'] }, deletedAt: null },
  });

  return {
    locations: locationData,
    vulnerableInventory,
    totalTransactions,
    recentShipments,
  };
}
