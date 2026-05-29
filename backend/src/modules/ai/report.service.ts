import { prisma } from '../../lib/prisma';
import { getSupplierContext } from './context/supplier.context';
import { getQCContext } from './context/qc.context';
import { getInventoryContext } from './context/inventory.context';
import { getProductionContext } from './context/production.context';

// ============================================================
// MANUFACTURING INTELLIGENCE REPORT
// Executive summary generated from live operational data.
// ============================================================

export interface ManufacturingReport {
  overview: string;
  plantHealthScore: number;
  operationalStatus: 'EXCELLENT' | 'GOOD' | 'ATTENTION_NEEDED' | 'CRITICAL';
  metrics: {
    qcPassRate: number;
    totalLots: number;
    pendingQCLots: number;
    activeProductionOrders: number;
    completedBatches: number;
    highRiskLots: number;
    supplierRiskCount: number;
    inventoryLocations: number;
    recentQCFailures: number;
    totalInventoryMovements: number;
  };
  risks: Array<{
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    category: string;
    description: string;
    entity?: string;
  }>;
  recommendations: Array<{
    priority: number;
    action: string;
    reason: string;
    category: string;
  }>;
  recentIssues: Array<{
    type: string;
    description: string;
    timestamp: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  generatedAt: string;
}

/**
 * Generate a full Manufacturing Intelligence Report.
 * Pulls live data from all modules and synthesizes into executive summary.
 */
export async function generateReport(): Promise<ManufacturingReport> {
  // Gather context from all domains in parallel
  const [supplierCtx, qcCtx, inventoryCtx, productionCtx, lotCounts] = await Promise.all([
    getSupplierContext(),
    getQCContext(),
    getInventoryContext(),
    getProductionContext(),
    getLotCounts(),
  ]);

  // Calculate metrics
  const qcPassRate = qcCtx.totalInspections > 0
    ? ((qcCtx.totalInspections - qcCtx.totalFailures) / qcCtx.totalInspections) * 100
    : 100;

  const highRiskSuppliers = supplierCtx.suppliers.filter((s) => s.failureRate > 10);
  const highRiskLots = lotCounts.pendingQC; // Lots waiting = risk

  const metrics: ManufacturingReport['metrics'] = {
    qcPassRate: Math.round(qcPassRate * 10) / 10,
    totalLots: lotCounts.total,
    pendingQCLots: lotCounts.pendingQC,
    activeProductionOrders: productionCtx.inProgressOrders,
    completedBatches: productionCtx.completedOrders,
    highRiskLots,
    supplierRiskCount: highRiskSuppliers.length,
    inventoryLocations: inventoryCtx.locations.length,
    recentQCFailures: qcCtx.totalFailures,
    totalInventoryMovements: inventoryCtx.totalTransactions,
  };

  // Calculate Plant Health Score (0-100)
  const plantHealthScore = calculateHealthScore(metrics, supplierCtx, productionCtx);

  // Determine operational status
  const operationalStatus = getOperationalStatus(plantHealthScore);

  // Identify risks
  const risks = identifyRisks(supplierCtx, qcCtx, inventoryCtx, productionCtx, lotCounts);

  // Generate recommendations
  const recommendations = generateRecommendations(risks, metrics, supplierCtx);

  // Gather recent issues
  const recentIssues = buildRecentIssues(qcCtx, productionCtx);

  // Generate executive overview
  const overview = generateOverview(plantHealthScore, operationalStatus, metrics, risks);

  return {
    overview,
    plantHealthScore,
    operationalStatus,
    metrics,
    risks,
    recommendations,
    recentIssues,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function getLotCounts() {
  const [total, pendingQC, approved, consumed, rejected] = await Promise.all([
    prisma.rawMaterialLot.count({ where: { deletedAt: null } }),
    prisma.rawMaterialLot.count({ where: { status: 'PENDING_QC', deletedAt: null } }),
    prisma.rawMaterialLot.count({ where: { status: 'APPROVED', deletedAt: null } }),
    prisma.rawMaterialLot.count({ where: { status: 'CONSUMED', deletedAt: null } }),
    prisma.rawMaterialLot.count({ where: { status: 'REJECTED', deletedAt: null } }),
  ]);
  return { total, pendingQC, approved, consumed, rejected };
}

function calculateHealthScore(
  metrics: ManufacturingReport['metrics'],
  supplierCtx: Awaited<ReturnType<typeof getSupplierContext>>,
  productionCtx: Awaited<ReturnType<typeof getProductionContext>>
): number {
  let score = 100;

  // QC failures reduce score (-3 per failure, max -30)
  score -= Math.min(30, metrics.recentQCFailures * 3);

  // Pending QC lots reduce score (-5 per lot, max -25)
  score -= Math.min(25, metrics.pendingQCLots * 5);

  // High risk suppliers reduce score (-10 per supplier, max -20)
  score -= Math.min(20, metrics.supplierRiskCount * 10);

  // Blocked production reduces score (-8 per blocked order, max -16)
  score -= Math.min(16, productionCtx.blockedCount * 8);

  // Bonus: high QC pass rate adds points
  if (metrics.qcPassRate >= 95) score = Math.min(100, score + 5);

  // Bonus: active production is healthy
  if (metrics.activeProductionOrders > 0 || metrics.completedBatches > 0) score = Math.min(100, score + 3);

  return Math.max(0, Math.round(score));
}

function getOperationalStatus(score: number): ManufacturingReport['operationalStatus'] {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 65) return 'GOOD';
  if (score >= 40) return 'ATTENTION_NEEDED';
  return 'CRITICAL';
}

function identifyRisks(
  supplierCtx: Awaited<ReturnType<typeof getSupplierContext>>,
  qcCtx: Awaited<ReturnType<typeof getQCContext>>,
  inventoryCtx: Awaited<ReturnType<typeof getInventoryContext>>,
  productionCtx: Awaited<ReturnType<typeof getProductionContext>>,
  lotCounts: Awaited<ReturnType<typeof getLotCounts>>
): ManufacturingReport['risks'] {
  const risks: ManufacturingReport['risks'] = [];

  // Supplier risks
  for (const sup of supplierCtx.suppliers) {
    if (sup.failureRate > 20) {
      risks.push({ severity: 'HIGH', category: 'Supplier', description: `${sup.name} has ${sup.failureRate.toFixed(0)}% QC failure rate`, entity: sup.name });
    } else if (sup.failureRate > 5) {
      risks.push({ severity: 'MEDIUM', category: 'Supplier', description: `${sup.name} failure rate elevated at ${sup.failureRate.toFixed(0)}%`, entity: sup.name });
    }
  }

  // QC risks
  if (qcCtx.totalFailures > 0) {
    risks.push({ severity: qcCtx.overallFailureRate > 15 ? 'HIGH' : 'MEDIUM', category: 'Quality Control', description: `${qcCtx.totalFailures} QC failure(s) detected (${qcCtx.overallFailureRate.toFixed(1)}% failure rate)` });
  }

  if (lotCounts.pendingQC > 0) {
    risks.push({ severity: lotCounts.pendingQC > 3 ? 'HIGH' : 'MEDIUM', category: 'Quality Control', description: `${lotCounts.pendingQC} lot(s) awaiting QC inspection` });
  }

  // Production risks
  if (productionCtx.blockedCount > 0) {
    risks.push({ severity: 'HIGH', category: 'Production', description: `${productionCtx.blockedCount} production order(s) blocked` });
  }

  // Inventory risks
  for (const vuln of inventoryCtx.vulnerableInventory) {
    risks.push({ severity: vuln.riskScore > 70 ? 'HIGH' : 'MEDIUM', category: 'Inventory', description: `${vuln.location}: ${vuln.reason}` });
  }

  // Sort by severity
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return risks;
}

function generateRecommendations(
  risks: ManufacturingReport['risks'],
  metrics: ManufacturingReport['metrics'],
  supplierCtx: Awaited<ReturnType<typeof getSupplierContext>>
): ManufacturingReport['recommendations'] {
  const recs: ManufacturingReport['recommendations'] = [];
  let priority = 1;

  // Based on risks
  const highRiskSuppliers = supplierCtx.suppliers.filter((s) => s.failureRate > 10);
  if (highRiskSuppliers.length > 0) {
    recs.push({ priority: priority++, action: `Increase inspection frequency for ${highRiskSuppliers[0].name}`, reason: `Failure rate: ${highRiskSuppliers[0].failureRate.toFixed(0)}%`, category: 'Supplier Management' });
    if (highRiskSuppliers[0].failureRate > 20) {
      recs.push({ priority: priority++, action: `Schedule supplier audit for ${highRiskSuppliers[0].name}`, reason: 'Failure rate exceeds 20% threshold', category: 'Supplier Management' });
    }
  }

  if (metrics.pendingQCLots > 0) {
    recs.push({ priority: priority++, action: `Prioritize QC review for ${metrics.pendingQCLots} pending lot(s)`, reason: 'Pending lots block production pipeline', category: 'Quality Control' });
  }

  if (metrics.recentQCFailures > 0) {
    recs.push({ priority: priority++, action: 'Investigate root cause of recent QC failures', reason: `${metrics.recentQCFailures} failure(s) detected`, category: 'Quality Control' });
  }

  if (risks.some((r) => r.category === 'Production')) {
    recs.push({ priority: priority++, action: 'Review production schedule and material availability', reason: 'Production bottlenecks detected', category: 'Production' });
  }

  // General best practices
  if (recs.length === 0) {
    recs.push({ priority: priority++, action: 'Continue current operational protocols', reason: 'All systems performing within acceptable parameters', category: 'General' });
    recs.push({ priority: priority++, action: 'Schedule routine supplier audits', reason: 'Preventive maintenance of supply chain', category: 'Supplier Management' });
  }

  return recs;
}

function buildRecentIssues(
  qcCtx: Awaited<ReturnType<typeof getQCContext>>,
  productionCtx: Awaited<ReturnType<typeof getProductionContext>>
): ManufacturingReport['recentIssues'] {
  const issues: ManufacturingReport['recentIssues'] = [];

  // QC failures
  for (const failure of qcCtx.recentFailures.slice(0, 5)) {
    issues.push({
      type: 'QC Failure',
      description: `Lot ${failure.lotNumber} from ${failure.supplier} failed inspection${failure.notes ? `: ${failure.notes}` : ''}`,
      timestamp: failure.date,
      severity: 'HIGH',
    });
  }

  // Blocked production
  for (const blocked of productionCtx.blockedOrders.slice(0, 3)) {
    issues.push({
      type: 'Production Blocked',
      description: `${blocked.orderNumber} (${blocked.product}): ${blocked.reason}`,
      timestamp: new Date().toISOString(),
      severity: 'MEDIUM',
    });
  }

  // Sort by timestamp desc
  issues.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return issues;
}

function generateOverview(
  score: number,
  status: ManufacturingReport['operationalStatus'],
  metrics: ManufacturingReport['metrics'],
  risks: ManufacturingReport['risks']
): string {
  const statusText = {
    EXCELLENT: 'Manufacturing operations are running at peak performance',
    GOOD: 'Manufacturing operations remain stable',
    ATTENTION_NEEDED: 'Manufacturing operations require management attention',
    CRITICAL: 'Manufacturing operations are in critical state requiring immediate intervention',
  };

  const highRisks = risks.filter((r) => r.severity === 'HIGH' || r.severity === 'CRITICAL');

  let overview = `${statusText[status]} with a plant health score of ${score}/100.`;

  if (metrics.qcPassRate >= 90) {
    overview += ` QC performance is strong at ${metrics.qcPassRate}% pass rate.`;
  } else {
    overview += ` QC pass rate of ${metrics.qcPassRate}% is below target.`;
  }

  if (highRisks.length > 0) {
    overview += ` ${highRisks.length} high-priority risk(s) require immediate attention.`;
  }

  if (metrics.activeProductionOrders > 0) {
    overview += ` ${metrics.activeProductionOrders} production order(s) currently active.`;
  }

  return overview;
}
