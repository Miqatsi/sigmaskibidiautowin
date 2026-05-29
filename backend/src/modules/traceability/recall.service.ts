import { prisma } from '../../lib/prisma';

// ============================================================
// RECALL IMPACT SIMULATOR
// Answers: "What happens if this lot is contaminated?"
// Read-only simulation — no database records modified.
// ============================================================

/**
 * Risk Score Factors (per spec):
 * +40 if lot already consumed
 * +30 if production completed
 * +20 if inventory exists
 * +30 if dispatched externally
 *
 * Risk Levels:
 * 0-30   LOW
 * 31-70  MEDIUM
 * 71-100 HIGH
 * 100+   CRITICAL
 */
function calculateRiskScore(params: {
  lotConsumed: boolean;
  productionCompleted: boolean;
  inventoryExists: boolean;
  dispatched: boolean;
}): { riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } {
  let riskScore = 0;

  if (params.lotConsumed) riskScore += 40;
  if (params.productionCompleted) riskScore += 30;
  if (params.inventoryExists) riskScore += 20;
  if (params.dispatched) riskScore += 30;

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (riskScore > 100) riskLevel = 'CRITICAL';
  else if (riskScore >= 71) riskLevel = 'HIGH';
  else if (riskScore >= 31) riskLevel = 'MEDIUM';
  else riskLevel = 'LOW';

  return { riskScore, riskLevel };
}

/**
 * Dynamic recommendation engine.
 * Generates actions based on actual state of affected assets.
 */
function generateRecommendations(params: {
  lotConsumed: boolean;
  inProgressBatches: number;
  completedBatches: number;
  inventoryExists: boolean;
  outboundMovements: number;
  dispatched: boolean;
  riskLevel: string;
}): string[] {
  const actions: string[] = [];

  // Critical/High immediate actions
  if (params.riskLevel === 'CRITICAL') {
    actions.push('🚨 IMMEDIATE: Initiate product recall for all affected customers');
    actions.push('🚨 IMMEDIATE: Notify regulatory authorities within 24 hours');
  }

  if (params.riskLevel === 'HIGH' || params.riskLevel === 'CRITICAL') {
    actions.push('URGENT: Quarantine all affected batches in warehouse');
    actions.push('URGENT: Halt production lines using this material');
  }

  // Production in progress → stop immediately
  if (params.inProgressBatches > 0) {
    actions.push(`STOP PRODUCTION: ${params.inProgressBatches} batch(es) still in progress — halt immediately`);
  }

  // Inventory exists → quarantine
  if (params.inventoryExists) {
    actions.push('QUARANTINE: Isolate all affected inventory from warehouse floor');
  }

  // Completed batches → hold
  if (params.completedBatches > 0) {
    actions.push(`HOLD: ${params.completedBatches} completed batch(es) — prevent dispatch until cleared`);
  }

  // Outbound movements → trace
  if (params.outboundMovements > 0) {
    actions.push(`TRACE: ${params.outboundMovements} outbound movement(s) — verify delivery status`);
  }

  // External dispatch → notify customers
  if (params.dispatched) {
    actions.push('NOTIFY: Contact all affected customers immediately');
  }

  // Standard actions always included
  actions.push('Conduct root cause analysis on contaminated lot');
  actions.push('Perform supplier investigation and corrective action');
  actions.push('Document all actions for regulatory compliance file');

  // Positive signal if no dispatch
  if (!params.dispatched && params.lotConsumed) {
    actions.push('✅ No external dispatches detected — recall may be avoidable if batches are quarantined in time');
  }

  return actions;
}

// ============================================================
// RESPONSE INTERFACES
// ============================================================

export interface RecallImpactResult {
  contaminatedLot: {
    lotNumber: string;
    supplier: string;
    material: string;
    status: string;
    quantity: number;
    unit: string;
    receivedAt: string;
  };
  impact: {
    affectedProductionBatches: number;
    affectedFinishedLots: number;
    affectedInventoryLocations: number;
    affectedDispatches: number;
    totalQuantityAtRisk: number;
    unit: string;
  };
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  affectedBatches: Array<{
    id: string;
    batchNumber: string;
    status: string;
    product: string | null;
    quantity: number;
    unit: string;
    completedAt: string | null;
  }>;
  affectedInventory: Array<{
    id: string;
    type: string;
    location: string;
    quantity: number;
    unit: string;
    batchNumber: string | null;
    date: string;
  }>;
  affectedCustomers: Array<{
    id: string;
    name: string;
    dispatchNumber: string;
    quantity: number;
    date: string;
  }>; // Empty until Dispatch module is implemented
  recommendedActions: string[];
  simulatedAt: string;
}

export interface RecallGraphResult {
  nodes: Array<{
    id: string;
    type: 'LOT' | 'BATCH' | 'INVENTORY' | 'CUSTOMER';
    label: string;
    status?: string;
    riskLevel?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label: string;
  }>;
}

// ============================================================
// MAIN SIMULATION SERVICE
// ============================================================

/**
 * Simulate a recall event for a given lot number.
 * Traces forward: Lot → Batches → Inventory → (Customers)
 * Read-only — no database modifications.
 */
export async function simulateRecall(lotNumber: string): Promise<RecallImpactResult | null> {
  // 1. Find the contaminated lot
  const lot = await prisma.rawMaterialLot.findFirst({
    where: { lotNumber, deletedAt: null },
    include: {
      material: { select: { name: true, code: true } },
      supplier: { select: { name: true, code: true } },
      productionBatchLots: {
        include: {
          batch: {
            include: {
              order: { include: { product: { select: { name: true, code: true } } } },
              inventoryTransactions: {
                where: { deletedAt: null },
                include: { storageLocation: { select: { name: true, code: true } } },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      },
    },
  });

  if (!lot) return null;

  // 2. Map affected batches
  const affectedBatches = lot.productionBatchLots.map((pbl) => ({
    id: pbl.batch.id,
    batchNumber: pbl.batch.lotNumber,
    status: pbl.batch.status,
    product: pbl.batch.order?.product
      ? `${pbl.batch.order.product.name} (${pbl.batch.order.product.code})`
      : null,
    quantity: pbl.batch.quantity,
    unit: pbl.batch.unit,
    completedAt: pbl.batch.completedAt?.toISOString() || null,
  }));

  // 3. Map affected inventory
  const affectedInventory = lot.productionBatchLots.flatMap((pbl) =>
    pbl.batch.inventoryTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      location: tx.storageLocation.name,
      quantity: tx.quantity,
      unit: tx.unit,
      batchNumber: pbl.batch.lotNumber,
      date: tx.createdAt.toISOString(),
    }))
  );

  // 4. Affected customers — empty until Dispatch module
  // Future: query dispatch table for batches that have been shipped
  const affectedCustomers: RecallImpactResult['affectedCustomers'] = [];

  // 5. Calculate risk score
  const lotConsumed = lot.status === 'CONSUMED';
  const completedBatches = affectedBatches.filter((b) => b.status === 'COMPLETED');
  const inProgressBatches = affectedBatches.filter((b) => b.status === 'IN_PROGRESS');
  const inventoryExists = affectedInventory.length > 0;
  const outboundMovements = affectedInventory.filter((i) => i.type === 'SHIP' || i.type === 'OUT');
  const dispatched = affectedCustomers.length > 0 || outboundMovements.length > 0;

  const { riskScore, riskLevel } = calculateRiskScore({
    lotConsumed,
    productionCompleted: completedBatches.length > 0,
    inventoryExists,
    dispatched,
  });

  // 6. Generate recommendations
  const recommendedActions = generateRecommendations({
    lotConsumed,
    inProgressBatches: inProgressBatches.length,
    completedBatches: completedBatches.length,
    inventoryExists,
    outboundMovements: outboundMovements.length,
    dispatched,
    riskLevel,
  });

  // 7. Calculate impact summary
  const uniqueLocations = new Set(affectedInventory.map((i) => i.location));
  const uniqueProducts = new Set(affectedBatches.map((b) => b.product).filter(Boolean));
  const totalQuantityAtRisk = affectedBatches.reduce((sum, b) => sum + b.quantity, 0);
  const batchUnit = affectedBatches[0]?.unit || lot.unit;

  // 8. Build summary
  const summary = buildSummary(lot.lotNumber, lot.material.name, lot.supplier.name, affectedBatches.length, uniqueProducts.size, riskLevel, riskScore);

  return {
    contaminatedLot: {
      lotNumber: lot.lotNumber,
      supplier: `${lot.supplier.name} (${lot.supplier.code})`,
      material: `${lot.material.name} (${lot.material.code})`,
      status: lot.status,
      quantity: lot.quantity,
      unit: lot.unit,
      receivedAt: lot.receivedAt.toISOString(),
    },
    impact: {
      affectedProductionBatches: affectedBatches.length,
      affectedFinishedLots: uniqueProducts.size,
      affectedInventoryLocations: uniqueLocations.size,
      affectedDispatches: affectedCustomers.length,
      totalQuantityAtRisk,
      unit: batchUnit,
    },
    riskScore,
    riskLevel,
    summary,
    affectedBatches,
    affectedInventory,
    affectedCustomers,
    recommendedActions,
    simulatedAt: new Date().toISOString(),
  };
}

/**
 * Generate graph-friendly structure for frontend visualization.
 * Returns nodes and edges for rendering a traceability graph.
 */
export async function simulateRecallGraph(lotNumber: string): Promise<RecallGraphResult | null> {
  const lot = await prisma.rawMaterialLot.findFirst({
    where: { lotNumber, deletedAt: null },
    include: {
      material: { select: { name: true } },
      supplier: { select: { name: true } },
      productionBatchLots: {
        include: {
          batch: {
            include: {
              order: { include: { product: { select: { name: true } } } },
              inventoryTransactions: {
                where: { deletedAt: null },
                include: { storageLocation: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!lot) return null;

  const nodes: RecallGraphResult['nodes'] = [];
  const edges: RecallGraphResult['edges'] = [];

  // Root node: contaminated lot
  const lotNodeId = `lot-${lot.id}`;
  nodes.push({
    id: lotNodeId,
    type: 'LOT',
    label: `${lot.lotNumber} (${lot.material.name})`,
    status: lot.status,
    riskLevel: 'HIGH',
  });

  // Batch nodes
  for (const pbl of lot.productionBatchLots) {
    const batchNodeId = `batch-${pbl.batch.id}`;
    nodes.push({
      id: batchNodeId,
      type: 'BATCH',
      label: `${pbl.batch.lotNumber} — ${pbl.batch.order?.product?.name || 'Unknown'}`,
      status: pbl.batch.status,
    });
    edges.push({
      source: lotNodeId,
      target: batchNodeId,
      label: 'consumed by',
    });

    // Inventory nodes
    for (const tx of pbl.batch.inventoryTransactions) {
      const invNodeId = `inv-${tx.id}`;
      nodes.push({
        id: invNodeId,
        type: 'INVENTORY',
        label: `${tx.storageLocation.name} (${tx.type}: ${tx.quantity} ${tx.unit})`,
        status: tx.type,
      });
      edges.push({
        source: batchNodeId,
        target: invNodeId,
        label: tx.type,
      });
    }
  }

  // Future: Customer/Dispatch nodes would be added here
  // when Dispatch module is implemented

  return { nodes, edges };
}

function buildSummary(
  lotNumber: string,
  material: string,
  supplier: string,
  batchCount: number,
  productCount: number,
  riskLevel: string,
  riskScore: number
): string {
  if (batchCount === 0) {
    return `Lot ${lotNumber} (${material} from ${supplier}) has not been used in any production batch. Risk is contained (score: ${riskScore}). Quarantine the lot immediately.`;
  }

  return `⚠️ RECALL SIMULATION: Lot ${lotNumber} (${material} from ${supplier}) has contaminated ${batchCount} production batch(es) affecting ${productCount} product(s). Risk score: ${riskScore} (${riskLevel}). Immediate action required.`;
}
