import { prisma } from '../../lib/prisma';
import { AIAnalysisResult } from './ai.schema';
import { getAIProvider } from './providers';

/**
 * Gather manufacturing context relevant to the user's question.
 * Pulls data from lots, QC, production, inventory, suppliers.
 */
async function gatherContext(question: string): Promise<string> {
  const lowerQ = question.toLowerCase();
  const contextParts: string[] = [];

  // Extract lot number from question if present
  const lotMatch = question.match(/[A-Z]{2,}-[\w-]+/i);
  const lotNumber = lotMatch ? lotMatch[0] : null;

  // 1. Lot-specific context
  if (lotNumber) {
    const lot = await prisma.rawMaterialLot.findFirst({
      where: { lotNumber: { contains: lotNumber, mode: 'insensitive' } },
      include: {
        material: { select: { name: true, code: true } },
        supplier: { select: { name: true, code: true } },
        qcLogs: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5 },
        productionBatchLots: {
          include: { batch: { select: { lotNumber: true, status: true } } },
        },
      },
    });

    if (lot) {
      contextParts.push(`LOT: ${lot.lotNumber}`);
      contextParts.push(`material: "${lot.material.name}" (${lot.material.code})`);
      contextParts.push(`supplier: "${lot.supplier.name}" (${lot.supplier.code})`);
      contextParts.push(`status: ${lot.status}`);
      contextParts.push(`quantity: ${lot.quantity} ${lot.unit}`);
      contextParts.push(`received: ${lot.receivedAt.toISOString()}`);

      if (lot.qcLogs.length > 0) {
        contextParts.push(`QC_HISTORY:`);
        lot.qcLogs.forEach(qc => {
          contextParts.push(`  - ${qc.type}: ${qc.result} (${qc.createdAt.toISOString()}) ${qc.notes || ''}`);
        });
      }

      if (lot.productionBatchLots.length > 0) {
        contextParts.push(`USED_IN_BATCHES:`);
        lot.productionBatchLots.forEach(pbl => {
          contextParts.push(`  - ${pbl.batch.lotNumber} (${pbl.batch.status})`);
        });
      }
    }
  }

  // 2. Supplier risk context (if question is about suppliers)
  if (lowerQ.includes('supplier') || lowerQ.includes('rate') || lowerQ.includes('risk')) {
    const suppliers = await prisma.supplier.findMany({
      where: { deletedAt: null },
      include: {
        rawMaterialLots: {
          where: { deletedAt: null },
          include: { qcLogs: { where: { deletedAt: null } } },
        },
      },
    });

    contextParts.push(`SUPPLIER_STATS:`);
    for (const sup of suppliers) {
      const totalQC = sup.rawMaterialLots.reduce((sum, lot) => sum + lot.qcLogs.length, 0);
      const failedQC = sup.rawMaterialLots.reduce(
        (sum, lot) => sum + lot.qcLogs.filter(qc => qc.result === 'FAIL').length, 0
      );
      const rate = totalQC > 0 ? (failedQC / totalQC) * 100 : 0;
      contextParts.push(`${sup.name}|${rate.toFixed(1)}|${totalQC}`);
    }
    contextParts.push(`END_STATS`);
  }

  // 3. Recent QC failures (general context)
  if (lowerQ.includes('fail') || lowerQ.includes('qc') || lowerQ.includes('quality')) {
    const recentFailures = await prisma.qCLog.findMany({
      where: { result: 'FAIL', deletedAt: null },
      include: {
        rawMaterialLot: { select: { lotNumber: true, supplier: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (recentFailures.length > 0) {
      contextParts.push(`RECENT_FAILURES (${recentFailures.length}):`);
      recentFailures.forEach(f => {
        contextParts.push(`  - Lot: ${f.rawMaterialLot?.lotNumber || 'N/A'}, Supplier: ${f.rawMaterialLot?.supplier?.name || 'N/A'}, Date: ${f.createdAt.toISOString()}`);
      });
    }
  }

  // 4. Inventory context (if about impact/affected)
  if (lowerQ.includes('affected') || lowerQ.includes('inventory') || lowerQ.includes('dispatch')) {
    const recentInventory = await prisma.inventoryTransaction.findMany({
      where: { deletedAt: null },
      include: {
        batch: { select: { lotNumber: true } },
        storageLocation: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (recentInventory.length > 0) {
      contextParts.push(`RECENT_INVENTORY (${recentInventory.length}):`);
      recentInventory.forEach(tx => {
        contextParts.push(`  - ${tx.type}: ${tx.quantity} ${tx.unit} @ ${tx.storageLocation.name} (batch: ${tx.batch?.lotNumber || 'N/A'})`);
      });
    }
  }

  // 5. Production overview
  if (lowerQ.includes('production') || lowerQ.includes('batch') || lowerQ.includes('order')) {
    const activeOrders = await prisma.productionOrder.findMany({
      where: { status: 'IN_PROGRESS', deletedAt: null },
      include: { product: { select: { name: true } } },
      take: 10,
    });

    if (activeOrders.length > 0) {
      contextParts.push(`ACTIVE_PRODUCTION (${activeOrders.length}):`);
      activeOrders.forEach(o => {
        contextParts.push(`  - ${o.orderNumber}: ${o.product.name} (${o.quantity} ${o.unit})`);
      });
    }
  }

  return contextParts.join('\n');
}

/**
 * Main AI Copilot service — gathers context and generates analysis.
 */
export async function analyzeQuestion(question: string): Promise<AIAnalysisResult> {
  // 1. Gather relevant manufacturing context
  const context = await gatherContext(question);

  // 2. Get AI provider (mock or real LLM)
  const provider = getAIProvider();

  // 3. Generate analysis
  const result = await provider.analyze(context, question);

  return result;
}

/**
 * Get manufacturing summary stats for dashboard AI widget.
 */
export async function getManufacturingSummary(): Promise<Record<string, unknown>> {
  const [totalLots, pendingQC, failedQC, activeOrders, recentTransactions] = await Promise.all([
    prisma.rawMaterialLot.count({ where: { deletedAt: null } }),
    prisma.rawMaterialLot.count({ where: { status: 'PENDING_QC', deletedAt: null } }),
    prisma.qCLog.count({ where: { result: 'FAIL', deletedAt: null } }),
    prisma.productionOrder.count({ where: { status: 'IN_PROGRESS', deletedAt: null } }),
    prisma.inventoryTransaction.count({ where: { deletedAt: null } }),
  ]);

  return {
    totalLots,
    pendingQC,
    failedQC,
    activeOrders,
    recentTransactions,
    healthScore: pendingQC === 0 && failedQC === 0 ? 100 : Math.max(0, 100 - (pendingQC * 5) - (failedQC * 10)),
  };
}
