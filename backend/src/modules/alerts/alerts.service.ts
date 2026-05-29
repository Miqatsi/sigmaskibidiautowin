import { prisma } from '../../lib/prisma';

// ============================================================
// OPERATIONAL ALERT ENGINE
// Proactively identifies manufacturing risks from live data.
// ============================================================

export type AlertType = 'QC_FAILURE' | 'SUPPLIER_RISK' | 'EXPIRY' | 'PRODUCTION_BLOCKER' | 'RECALL_EXPOSURE' | 'INVENTORY_HEALTH';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  severityScore: number;
  title: string;
  description: string;
  recommendedAction: string;
  businessImpact: string;
  link?: string; // Frontend route for click-through
  entity?: string; // Related entity ID or lot number
  createdAt: string;
}

export interface AlertSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface AlertsResponse {
  alerts: Alert[];
  summary: AlertSummary;
}

const SEVERITY_SCORES: Record<AlertSeverity, number> = {
  LOW: 25,
  MEDIUM: 50,
  HIGH: 75,
  CRITICAL: 100,
};

/**
 * Main Alert Engine — scans all modules and generates prioritized alerts.
 */
export async function generateAlerts(): Promise<AlertsResponse> {
  const alerts: Alert[] = [];

  // Run all alert generators in parallel
  const [qcAlerts, supplierAlerts, expiryAlerts, productionAlerts, inventoryAlerts] = await Promise.all([
    generateQCAlerts(),
    generateSupplierAlerts(),
    generateExpiryAlerts(),
    generateProductionAlerts(),
    generateInventoryAlerts(),
  ]);

  alerts.push(...qcAlerts, ...supplierAlerts, ...expiryAlerts, ...productionAlerts, ...inventoryAlerts);

  // Sort: Critical first, then by severity score desc, then by date
  alerts.sort((a, b) => b.severityScore - a.severityScore || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const summary: AlertSummary = {
    critical: alerts.filter((a) => a.severity === 'CRITICAL').length,
    high: alerts.filter((a) => a.severity === 'HIGH').length,
    medium: alerts.filter((a) => a.severity === 'MEDIUM').length,
    low: alerts.filter((a) => a.severity === 'LOW').length,
    total: alerts.length,
  };

  return { alerts, summary };
}

/**
 * Get summary only (lightweight for dashboard widget).
 */
export async function getAlertSummary(): Promise<AlertSummary> {
  const { summary } = await generateAlerts();
  return summary;
}

// ============================================================
// ALERT GENERATORS
// ============================================================

async function generateQCAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Recent QC failures (last 7 days)
  const recentFailures = await prisma.qCLog.findMany({
    where: {
      result: 'FAIL',
      deletedAt: null,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: {
      rawMaterialLot: { select: { lotNumber: true, material: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  for (const failure of recentFailures) {
    const lotNumber = failure.rawMaterialLot?.lotNumber || 'Unknown';
    const material = failure.rawMaterialLot?.material?.name || 'Unknown material';

    alerts.push({
      id: `qc-fail-${failure.id}`,
      type: 'QC_FAILURE',
      severity: 'HIGH',
      severityScore: SEVERITY_SCORES.HIGH,
      title: `Lot ${lotNumber} failed QC`,
      description: `${material} — ${failure.notes || 'QC inspection failed'}`,
      recommendedAction: 'Quarantine lot and initiate supplier investigation.',
      businessImpact: 'Failed lot cannot enter production. May cause production delays if no alternative stock available.',
      link: `/dashboard/qc`,
      entity: lotNumber,
      createdAt: failure.createdAt.toISOString(),
    });
  }

  // Lots pending QC too long (> 24 hours)
  const stalePending = await prisma.rawMaterialLot.findMany({
    where: {
      status: 'PENDING_QC',
      deletedAt: null,
      createdAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { lotNumber: true, material: { select: { name: true } }, createdAt: true },
  });

  for (const lot of stalePending) {
    const hoursWaiting = Math.round((Date.now() - lot.createdAt.getTime()) / (60 * 60 * 1000));
    alerts.push({
      id: `qc-pending-${lot.lotNumber}`,
      type: 'QC_FAILURE',
      severity: hoursWaiting > 48 ? 'HIGH' : 'MEDIUM',
      severityScore: hoursWaiting > 48 ? SEVERITY_SCORES.HIGH : SEVERITY_SCORES.MEDIUM,
      title: `Lot ${lot.lotNumber} awaiting QC for ${hoursWaiting}h`,
      description: `${lot.material.name} has been pending inspection for ${hoursWaiting} hours.`,
      recommendedAction: 'Prioritize QC inspection to unblock production pipeline.',
      businessImpact: 'Delayed QC blocks production scheduling and may cause order fulfillment delays.',
      link: `/dashboard/lots`,
      entity: lot.lotNumber,
      createdAt: lot.createdAt.toISOString(),
    });
  }

  return alerts;
}

async function generateSupplierAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const suppliers = await prisma.supplier.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, code: true },
  });

  for (const sup of suppliers) {
    const lots = await prisma.rawMaterialLot.findMany({
      where: { supplierId: sup.id, deletedAt: null },
      select: { id: true },
    });

    if (lots.length === 0) continue;

    const lotIds = lots.map((l) => l.id);
    const failedCount = await prisma.qCLog.count({
      where: { rawMaterialLotId: { in: lotIds }, result: 'FAIL', deletedAt: null },
    });

    const failureRate = (failedCount / lots.length) * 100;

    if (failureRate > 20) {
      alerts.push({
        id: `supplier-risk-${sup.id}`,
        type: 'SUPPLIER_RISK',
        severity: 'HIGH',
        severityScore: SEVERITY_SCORES.HIGH,
        title: `${sup.name} — high failure rate`,
        description: `QC failure rate: ${failureRate.toFixed(0)}% (${failedCount}/${lots.length} lots failed).`,
        recommendedAction: 'Increase inspection frequency. Schedule supplier audit.',
        businessImpact: 'High supplier failure rate increases production risk and may require alternative sourcing.',
        link: `/dashboard/suppliers`,
        entity: sup.name,
        createdAt: new Date().toISOString(),
      });
    } else if (failureRate > 5) {
      alerts.push({
        id: `supplier-watch-${sup.id}`,
        type: 'SUPPLIER_RISK',
        severity: 'MEDIUM',
        severityScore: SEVERITY_SCORES.MEDIUM,
        title: `${sup.name} — elevated failure rate`,
        description: `QC failure rate: ${failureRate.toFixed(0)}% — above 5% threshold.`,
        recommendedAction: 'Monitor closely. Review recent deliveries.',
        businessImpact: 'Elevated failure rate may indicate declining supplier quality.',
        link: `/dashboard/suppliers`,
        entity: sup.name,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

async function generateExpiryAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const nearExpiry = await prisma.rawMaterialLot.findMany({
    where: {
      deletedAt: null,
      status: { in: ['APPROVED', 'PENDING_QC'] },
      expiryDate: {
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Within 7 days
        gte: new Date(), // Not already expired
      },
    },
    include: { material: { select: { name: true } } },
  });

  for (const lot of nearExpiry) {
    const daysLeft = Math.round((lot.expiryDate!.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    alerts.push({
      id: `expiry-${lot.id}`,
      type: 'EXPIRY',
      severity: daysLeft <= 2 ? 'HIGH' : 'MEDIUM',
      severityScore: daysLeft <= 2 ? SEVERITY_SCORES.HIGH : SEVERITY_SCORES.MEDIUM,
      title: `${lot.lotNumber} expires in ${daysLeft} day(s)`,
      description: `${lot.material.name} — ${lot.quantity} ${lot.unit} at risk of expiration.`,
      recommendedAction: daysLeft <= 2 ? 'Use immediately or dispose per SOP.' : 'Prioritize usage in next production batch.',
      businessImpact: `${lot.quantity} ${lot.unit} of ${lot.material.name} will be wasted if not used.`,
      link: `/dashboard/lots`,
      entity: lot.lotNumber,
      createdAt: new Date().toISOString(),
    });
  }

  // Already expired
  const expired = await prisma.rawMaterialLot.findMany({
    where: {
      deletedAt: null,
      status: { in: ['APPROVED', 'PENDING_QC'] },
      expiryDate: { lt: new Date() },
    },
    include: { material: { select: { name: true } } },
  });

  for (const lot of expired) {
    alerts.push({
      id: `expired-${lot.id}`,
      type: 'EXPIRY',
      severity: 'CRITICAL',
      severityScore: SEVERITY_SCORES.CRITICAL,
      title: `${lot.lotNumber} HAS EXPIRED`,
      description: `${lot.material.name} — expired and must not be used in production.`,
      recommendedAction: 'Quarantine immediately. Initiate disposal procedure.',
      businessImpact: 'Using expired materials violates compliance and risks product safety.',
      link: `/dashboard/lots`,
      entity: lot.lotNumber,
      createdAt: new Date().toISOString(),
    });
  }

  return alerts;
}

async function generateProductionAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Planned orders with no approved materials available
  const plannedOrders = await prisma.productionOrder.findMany({
    where: { status: 'PLANNED', deletedAt: null },
    include: { product: { select: { name: true } } },
  });

  const approvedLots = await prisma.rawMaterialLot.count({
    where: { status: 'APPROVED', deletedAt: null },
  });

  if (plannedOrders.length > 0 && approvedLots === 0) {
    for (const order of plannedOrders) {
      alerts.push({
        id: `prod-blocked-${order.id}`,
        type: 'PRODUCTION_BLOCKER',
        severity: 'HIGH',
        severityScore: SEVERITY_SCORES.HIGH,
        title: `${order.orderNumber} blocked — no materials`,
        description: `${order.product.name}: No approved raw materials available for production.`,
        recommendedAction: 'Expedite QC approval or incoming material delivery.',
        businessImpact: 'Production delays may impact customer delivery commitments.',
        link: `/dashboard/production`,
        entity: order.orderNumber,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

async function generateInventoryAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Locations with no recent activity (potential dead stock)
  const locations = await prisma.storageLocation.findMany({
    where: { deletedAt: null },
    include: {
      transactions: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  for (const loc of locations) {
    if (loc.transactions.length > 0) {
      const lastActivity = loc.transactions[0].createdAt;
      const daysSinceActivity = Math.round((Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000));

      if (daysSinceActivity > 30) {
        alerts.push({
          id: `inv-stale-${loc.id}`,
          type: 'INVENTORY_HEALTH',
          severity: 'LOW',
          severityScore: SEVERITY_SCORES.LOW,
          title: `${loc.name} — no activity for ${daysSinceActivity} days`,
          description: `Storage location has had no movements in ${daysSinceActivity} days.`,
          recommendedAction: 'Review inventory levels and consider redistribution.',
          businessImpact: 'Stale inventory ties up capital and may indicate planning issues.',
          link: `/dashboard/inventory`,
          entity: loc.name,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return alerts;
}
