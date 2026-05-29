import { prisma } from '../../../lib/prisma';

// ============================================================
// MANUFACTURING ANALYTICS SERVICES
// Real database calculations — no generic responses.
// ============================================================

// --- SUPPLIER ANALYTICS ---

export interface SupplierRankingEntry {
  id: string;
  name: string;
  code: string;
  totalLots: number;
  failedLots: number;
  failureRate: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedBatches: number;
  affectedOrders: number;
}

export async function getSupplierRanking(): Promise<SupplierRankingEntry[]> {
  const suppliers = await prisma.supplier.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, code: true },
  });

  const ranking: SupplierRankingEntry[] = [];

  for (const sup of suppliers) {
    const lots = await prisma.rawMaterialLot.findMany({
      where: { supplierId: sup.id, deletedAt: null },
      select: { id: true },
    });

    if (lots.length === 0) continue;

    const lotIds = lots.map(l => l.id);

    const [failedQCCount, batchLinks] = await Promise.all([
      prisma.qCLog.count({ where: { rawMaterialLotId: { in: lotIds }, result: 'FAIL', deletedAt: null } }),
      prisma.productionBatchRawMaterial.findMany({
        where: { rawMaterialLotId: { in: lotIds } },
        select: { batch: { select: { orderId: true } } },
      }),
    ]);

    const failedLotIds = await prisma.qCLog.findMany({
      where: { rawMaterialLotId: { in: lotIds }, result: 'FAIL', deletedAt: null },
      select: { rawMaterialLotId: true },
      distinct: ['rawMaterialLotId'],
    });

    const failedLots = failedLotIds.length;
    const failureRate = (failedLots / lots.length) * 100;
    const affectedBatches = batchLinks.length;
    const affectedOrders = new Set(batchLinks.map(b => b.batch.orderId)).size;

    ranking.push({
      id: sup.id,
      name: sup.name,
      code: sup.code,
      totalLots: lots.length,
      failedLots,
      failureRate,
      riskLevel: failureRate > 20 ? 'HIGH' : failureRate > 5 ? 'MEDIUM' : 'LOW',
      affectedBatches,
      affectedOrders,
    });
  }

  return ranking.sort((a, b) => b.failureRate - a.failureRate);
}

// --- QC ANALYTICS ---

export interface QCAnalytics {
  totalInspections: number;
  totalFailures: number;
  overallFailureRate: number;
  recentFailures: Array<{ lotNumber: string; supplier: string; material: string; notes: string | null; date: string }>;
  highRiskLots: Array<{ lotNumber: string; material: string; supplier: string; reason: string }>;
  failuresBySupplier: Array<{ supplier: string; failures: number; rate: number }>;
}

export async function getQCAnalytics(): Promise<QCAnalytics> {
  const [totalInspections, totalFailures] = await Promise.all([
    prisma.qCLog.count({ where: { deletedAt: null } }),
    prisma.qCLog.count({ where: { result: 'FAIL', deletedAt: null } }),
  ]);

  const recentFailuresRaw = await prisma.qCLog.findMany({
    where: { result: 'FAIL', deletedAt: null },
    include: { rawMaterialLot: { include: { material: { select: { name: true } }, supplier: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const recentFailures = recentFailuresRaw.map(f => ({
    lotNumber: f.rawMaterialLot?.lotNumber || 'N/A',
    supplier: f.rawMaterialLot?.supplier?.name || 'N/A',
    material: f.rawMaterialLot?.material?.name || 'N/A',
    notes: f.notes,
    date: f.createdAt.toISOString(),
  }));

  // High risk lots: PENDING_QC for > 24h or from risky suppliers
  const pendingLots = await prisma.rawMaterialLot.findMany({
    where: { status: 'PENDING_QC', deletedAt: null },
    include: { material: { select: { name: true } }, supplier: { select: { name: true } } },
  });

  const highRiskLots = pendingLots.map(lot => ({
    lotNumber: lot.lotNumber,
    material: lot.material.name,
    supplier: lot.supplier.name,
    reason: (Date.now() - lot.createdAt.getTime()) > 24 * 60 * 60 * 1000
      ? `Pending QC for ${Math.round((Date.now() - lot.createdAt.getTime()) / (60 * 60 * 1000))}h`
      : 'Awaiting inspection',
  }));

  // Failures by supplier
  const supplierRanking = await getSupplierRanking();
  const failuresBySupplier = supplierRanking
    .filter(s => s.failedLots > 0)
    .map(s => ({ supplier: s.name, failures: s.failedLots, rate: s.failureRate }));

  return {
    totalInspections,
    totalFailures,
    overallFailureRate: totalInspections > 0 ? (totalFailures / totalInspections) * 100 : 0,
    recentFailures,
    highRiskLots,
    failuresBySupplier,
  };
}

// --- PRODUCTION ANALYTICS ---

export interface ProductionAnalytics {
  totalOrders: number;
  inProgress: number;
  completed: number;
  planned: number;
  blockedOrders: Array<{ orderNumber: string; product: string; reason: string }>;
  atRiskBatches: Array<{ lotNumber: string; status: string; reason: string }>;
}

export async function getProductionAnalytics(): Promise<ProductionAnalytics> {
  const [totalOrders, inProgress, completed, planned] = await Promise.all([
    prisma.productionOrder.count({ where: { deletedAt: null } }),
    prisma.productionOrder.count({ where: { status: 'IN_PROGRESS', deletedAt: null } }),
    prisma.productionOrder.count({ where: { status: 'COMPLETED', deletedAt: null } }),
    prisma.productionOrder.count({ where: { status: 'PLANNED', deletedAt: null } }),
  ]);

  // Blocked: planned orders with no approved materials
  const approvedLots = await prisma.rawMaterialLot.count({ where: { status: 'APPROVED', deletedAt: null } });
  const plannedOrders = await prisma.productionOrder.findMany({
    where: { status: 'PLANNED', deletedAt: null },
    include: { product: { select: { name: true } } },
  });

  const pendingQC = await prisma.rawMaterialLot.count({ where: { status: 'PENDING_QC', deletedAt: null } });

  const blockedOrders = approvedLots === 0
    ? plannedOrders.map(o => ({
        orderNumber: o.orderNumber,
        product: o.product.name,
        reason: pendingQC > 0 ? `Waiting for QC approval (${pendingQC} lot(s) pending)` : 'No approved raw materials available',
      }))
    : [];

  // At-risk batches: IN_PROGRESS for too long
  const inProgressBatches = await prisma.productionBatch.findMany({
    where: { status: 'IN_PROGRESS', deletedAt: null },
    select: { lotNumber: true, status: true, startedAt: true },
  });

  const atRiskBatches = inProgressBatches
    .filter(b => (Date.now() - b.startedAt.getTime()) > 48 * 60 * 60 * 1000)
    .map(b => ({
      lotNumber: b.lotNumber,
      status: b.status,
      reason: `In progress for ${Math.round((Date.now() - b.startedAt.getTime()) / (60 * 60 * 1000))}h — may be stalled`,
    }));

  return { totalOrders, inProgress, completed, planned, blockedOrders, atRiskBatches };
}

// --- INVENTORY ANALYTICS ---

export interface InventoryAnalytics {
  totalLocations: number;
  totalTransactions: number;
  expiringLots: Array<{ lotNumber: string; material: string; daysLeft: number; quantity: number; unit: string }>;
  expiredLots: Array<{ lotNumber: string; material: string; daysExpired: number; quantity: number; unit: string }>;
  vulnerableLocations: Array<{ name: string; reason: string; riskScore: number }>;
}

export async function getInventoryAnalytics(): Promise<InventoryAnalytics> {
  const [totalLocations, totalTransactions] = await Promise.all([
    prisma.storageLocation.count({ where: { deletedAt: null } }),
    prisma.inventoryTransaction.count({ where: { deletedAt: null } }),
  ]);

  // Expiring within 7 days
  const expiringRaw = await prisma.rawMaterialLot.findMany({
    where: { deletedAt: null, status: { in: ['APPROVED', 'PENDING_QC'] }, expiryDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), gte: new Date() } },
    include: { material: { select: { name: true } } },
  });

  const expiringLots = expiringRaw.map(l => ({
    lotNumber: l.lotNumber,
    material: l.material.name,
    daysLeft: Math.round((l.expiryDate!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    quantity: l.quantity,
    unit: l.unit,
  }));

  // Already expired
  const expiredRaw = await prisma.rawMaterialLot.findMany({
    where: { deletedAt: null, status: { in: ['APPROVED', 'PENDING_QC'] }, expiryDate: { lt: new Date() } },
    include: { material: { select: { name: true } } },
  });

  const expiredLots = expiredRaw.map(l => ({
    lotNumber: l.lotNumber,
    material: l.material.name,
    daysExpired: Math.round((Date.now() - l.expiryDate!.getTime()) / (24 * 60 * 60 * 1000)),
    quantity: l.quantity,
    unit: l.unit,
  }));

  return { totalLocations, totalTransactions, expiringLots, expiredLots, vulnerableLocations: [] };
}

// --- RISK ANALYTICS ---

export interface RiskAnalytics {
  topRisks: Array<{ severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; category: string; description: string; action: string }>;
  priorityActions: string[];
  overallRiskScore: number;
}

export async function getRiskAnalytics(): Promise<RiskAnalytics> {
  const [supplierRanking, qcAnalytics, prodAnalytics, invAnalytics] = await Promise.all([
    getSupplierRanking(),
    getQCAnalytics(),
    getProductionAnalytics(),
    getInventoryAnalytics(),
  ]);

  const topRisks: RiskAnalytics['topRisks'] = [];
  const priorityActions: string[] = [];

  // Supplier risks
  const highRiskSuppliers = supplierRanking.filter(s => s.riskLevel === 'HIGH');
  for (const s of highRiskSuppliers) {
    topRisks.push({ severity: 'HIGH', category: 'Supplier', description: `${s.name}: ${s.failureRate.toFixed(0)}% failure rate (${s.failedLots}/${s.totalLots} lots)`, action: `Audit ${s.name} and increase inspection frequency` });
  }

  // QC risks
  if (qcAnalytics.highRiskLots.length > 0) {
    topRisks.push({ severity: 'MEDIUM', category: 'QC', description: `${qcAnalytics.highRiskLots.length} lot(s) awaiting QC inspection`, action: 'Prioritize QC review' });
  }
  if (qcAnalytics.overallFailureRate > 15) {
    topRisks.push({ severity: 'HIGH', category: 'QC', description: `Overall QC failure rate ${qcAnalytics.overallFailureRate.toFixed(1)}% — above 15% threshold`, action: 'Review inspection criteria and supplier quality' });
  }

  // Production risks
  if (prodAnalytics.blockedOrders.length > 0) {
    topRisks.push({ severity: 'HIGH', category: 'Production', description: `${prodAnalytics.blockedOrders.length} production order(s) blocked`, action: 'Expedite material availability' });
  }

  // Inventory risks
  if (invAnalytics.expiredLots.length > 0) {
    topRisks.push({ severity: 'CRITICAL', category: 'Inventory', description: `${invAnalytics.expiredLots.length} lot(s) EXPIRED — must not be used`, action: 'Quarantine and dispose immediately' });
  }
  if (invAnalytics.expiringLots.length > 0) {
    topRisks.push({ severity: 'MEDIUM', category: 'Inventory', description: `${invAnalytics.expiringLots.length} lot(s) expiring within 7 days`, action: 'Prioritize usage or plan disposal' });
  }

  // Sort by severity
  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  topRisks.sort((a, b) => order[a.severity] - order[b.severity]);

  // Priority actions
  topRisks.slice(0, 5).forEach(r => priorityActions.push(r.action));

  // Overall risk score
  let score = 100;
  score -= highRiskSuppliers.length * 15;
  score -= qcAnalytics.highRiskLots.length * 5;
  score -= prodAnalytics.blockedOrders.length * 10;
  score -= invAnalytics.expiredLots.length * 20;
  score -= invAnalytics.expiringLots.length * 5;

  return { topRisks, priorityActions, overallRiskScore: Math.max(0, score) };
}
