import { prisma } from '../../lib/prisma';
import { AIAnalysisResult, CopilotIntent, ManufacturingContext, assessDataQuality } from './ai.schema';
import { getAIProvider } from './providers';
import { getSupplierContext } from './context/supplier.context';
import { getQCContext } from './context/qc.context';
import { getInventoryContext } from './context/inventory.context';
import { getProductionContext } from './context/production.context';
import { getSupplierRanking, getQCAnalytics, getProductionAnalytics, getInventoryAnalytics, getRiskAnalytics } from './context/analytics.context';

// ============================================================
// ENTITY EXTRACTION
// ============================================================

interface ExtractedEntity {
  type: 'SUPPLIER' | 'LOT' | 'NONE';
  name: string | null;
  validated: boolean;
  dbId: string | null;
}

/**
 * Extract and validate entity from question.
 * Checks database to confirm entity exists.
 */
async function extractEntity(question: string): Promise<ExtractedEntity> {
  // 1. Try to extract lot number (pattern: XX-XXXX-XXX)
  const lotMatch = question.match(/\b([A-Z]{2,}-[\w-]+)\b/i);
  if (lotMatch) {
    const lotNumber = lotMatch[1];
    const lot = await prisma.rawMaterialLot.findFirst({
      where: { lotNumber: { equals: lotNumber, mode: 'insensitive' }, deletedAt: null },
      select: { id: true, lotNumber: true },
    });
    if (lot) {
      return { type: 'LOT', name: lot.lotNumber, validated: true, dbId: lot.id };
    }
    // Also check production batches
    const batch = await prisma.productionBatch.findFirst({
      where: { lotNumber: { equals: lotNumber, mode: 'insensitive' }, deletedAt: null },
      select: { id: true, lotNumber: true },
    });
    if (batch) {
      return { type: 'LOT', name: batch.lotNumber, validated: true, dbId: batch.id };
    }
    // Lot pattern found but doesn't exist in DB
    return { type: 'LOT', name: lotNumber, validated: false, dbId: null };
  }

  // 2. Try to extract supplier name (PT ..., CV ..., or quoted name)
  const supplierPatterns = [
    /["']([^"']+)["']/,                                    // "PT Bahan Murah Jaya"
    /\b(PT\s+[A-Za-z\s]+?)(?:\s+(?:risky|risk|bad|worst|fail|perform|has|is)|[?.,]|$)/i,  // PT Bahan Murah Jaya risky
    /\b(CV\s+[A-Za-z\s]+?)(?:\s+(?:risky|risk|bad|worst|fail|perform|has|is)|[?.,]|$)/i,  // CV Sedang Saja
    /(?:supplier|vendor)\s+(.+?)(?:\s+(?:risky|risk|has|is)|[?.,]|$)/i,  // supplier XYZ risky
    /(?:is|about)\s+(.+?)\s+(?:risky|risk|bad|worst|perform)/i,  // is XYZ risky
    /(?:why|how)\s+(?:is|does)\s+(.+?)\s+(?:risky|risk|bad|fail|have)/i,  // why is XYZ risky
  ];

  for (const pattern of supplierPatterns) {
    const match = question.match(pattern);
    if (match && match[1].trim().length > 3) {
      const candidateName = match[1].trim();
      // Skip common false positives
      if (['the supplier', 'this supplier', 'a supplier', 'which supplier', 'what supplier'].includes(candidateName.toLowerCase())) continue;

      // Validate against database
      const supplier = await prisma.supplier.findFirst({
        where: { name: { contains: candidateName, mode: 'insensitive' }, deletedAt: null },
        select: { id: true, name: true },
      });
      if (supplier) {
        return { type: 'SUPPLIER', name: supplier.name, validated: true, dbId: supplier.id };
      }

      // Entity mentioned but not found in DB
      return { type: 'SUPPLIER', name: candidateName, validated: false, dbId: null };
    }
  }

  return { type: 'NONE', name: null, validated: false, dbId: null };
}

// ============================================================
// INTENT DETECTION
// ============================================================

function detectIntent(question: string, entity: ExtractedEntity): CopilotIntent {
  const q = question.toLowerCase();

  // Entity-based intent detection (specific entity referenced)
  if (entity.type === 'SUPPLIER' && entity.validated) return 'SUPPLIER_RISK';
  if (entity.type === 'SUPPLIER' && !entity.validated) return 'SUPPLIER_RISK';
  if (entity.type === 'LOT' && (q.includes('fail') || q.includes('qc') || q.includes('reject') || q.includes('gagal'))) return 'QC_ANALYSIS';
  if (entity.type === 'LOT' && (q.includes('trace') || q.includes('contaminated') || q.includes('recall') || q.includes('impact'))) return 'TRACEABILITY';
  if (entity.type === 'LOT') return 'QC_ANALYSIS';

  // Analytics intents (aggregation/ranking questions — no specific entity)
  if (q.includes('ranking') || q.includes('rank') || q.includes('top') || q.includes('worst') || q.includes('best') || q.includes('highest') || q.includes('most')) {
    if (q.includes('supplier')) return 'SUPPLIER_ANALYTICS';
    if (q.includes('qc') || q.includes('fail') || q.includes('inspect')) return 'QC_ANALYTICS';
    if (q.includes('production') || q.includes('order') || q.includes('batch')) return 'PRODUCTION_ANALYTICS';
    if (q.includes('inventory') || q.includes('stock') || q.includes('expir')) return 'INVENTORY_ANALYTICS';
    return 'RISK_ANALYTICS';
  }

  // Risk/operational overview
  if (q.includes('risk') && (q.includes('today') || q.includes('operational') || q.includes('biggest') || q.includes('top'))) return 'RISK_ANALYTICS';
  if (q.includes('priority') || q.includes('attention') || q.includes('urgent')) return 'RISK_ANALYTICS';

  // Supplier analytics (no specific supplier named)
  if (q.includes('supplier') && (q.includes('rate') || q.includes('perform') || q.includes('risky') || q.includes('which'))) return 'SUPPLIER_ANALYTICS';

  // QC analytics
  if ((q.includes('qc') || q.includes('fail') || q.includes('inspect')) && (q.includes('trend') || q.includes('how many') || q.includes('which lot'))) return 'QC_ANALYTICS';

  // Production analytics
  if (q.includes('blocked') || q.includes('delay') || q.includes('stalled')) return 'PRODUCTION_ANALYTICS';
  if (q.includes('production') && (q.includes('which') || q.includes('status'))) return 'PRODUCTION_ANALYTICS';

  // Inventory analytics
  if (q.includes('expir') || q.includes('vulnerable') || q.includes('quarantine')) return 'INVENTORY_ANALYTICS';
  if (q.includes('inventory') && (q.includes('which') || q.includes('health'))) return 'INVENTORY_ANALYTICS';

  // Warehouse questions → route to inventory analytics (reuse)
  if (q.includes('warehouse') || q.includes('cold chain') || q.includes('storage') || q.includes('slot') || q.includes('hazard') || q.includes('segregat')) return 'INVENTORY_ANALYTICS';

  // Standard keyword-based
  if (q.includes('supplier') && q.includes('risk')) return 'SUPPLIER_RISK';
  if (q.includes('qc') || q.includes('fail') || q.includes('quality') || q.includes('reject')) return 'QC_ANALYSIS';
  if (q.includes('inventory') || q.includes('warehouse') || q.includes('stock')) return 'INVENTORY_RISK';
  if (q.includes('production') || q.includes('order') || q.includes('batch')) return 'PRODUCTION_ANALYSIS';
  if (q.includes('trace') || q.includes('contaminated') || q.includes('recall') || q.includes('impact')) return 'TRACEABILITY';

  return 'GENERAL';
}

// ============================================================
// CONTEXT RETRIEVAL
// ============================================================

async function retrieveContext(intent: CopilotIntent, question: string, entity: ExtractedEntity): Promise<Record<string, unknown>> {
  switch (intent) {
    case 'SUPPLIER_RISK':
      return { supplier: await getSupplierContext(entity.validated ? entity.name! : undefined), entity };

    case 'SUPPLIER_ANALYTICS':
      return { supplierRanking: await getSupplierRanking(), entity };

    case 'QC_ANALYSIS':
      return { qc: await getQCContext(entity.name || undefined), entity };

    case 'QC_ANALYTICS':
      return { qcAnalytics: await getQCAnalytics(), entity };

    case 'INVENTORY_RISK':
      return { inventory: await getInventoryContext(), entity };

    case 'INVENTORY_ANALYTICS':
      return { inventoryAnalytics: await getInventoryAnalytics(), entity };

    case 'PRODUCTION_ANALYSIS':
      return { production: await getProductionContext(), entity };

    case 'PRODUCTION_ANALYTICS':
      return { productionAnalytics: await getProductionAnalytics(), entity };

    case 'RISK_ANALYTICS':
      return { riskAnalytics: await getRiskAnalytics(), entity };

    case 'TRACEABILITY': {
      const qc = await getQCContext(entity.name || undefined);
      return { qc, entity, lotNumber: entity.name };
    }

    case 'GENERAL':
    default: {
      const [supplier, qc, production] = await Promise.all([
        getSupplierContext(),
        getQCContext(entity.name || undefined),
        getProductionContext(),
      ]);
      return { supplier, qc, production, entity };
    }
  }
}

// ============================================================
// MAIN COPILOT SERVICE
// ============================================================

/**
 * Entity-Aware AI Copilot.
 * Flow: Question → Intent Pre-check → Entity Extraction → Validation → Context Retrieval → Analysis
 *
 * RULES:
 * - Never generate risk assessment for entities that don't exist
 * - Never fall back to generic summaries when a specific entity is referenced
 * - Every claim must come from the database
 * - Analytics questions skip entity extraction
 */
export async function analyzeQuestion(question: string): Promise<AIAnalysisResult> {
  const q = question.toLowerCase();

  // Pre-check: is this an analytics/aggregation question? (no specific entity)
  const isAnalyticsQuestion = (
    (q.includes('which') || q.includes('ranking') || q.includes('top') || q.includes('highest') || q.includes('worst') || q.includes('most') || q.includes('how many')) &&
    !q.match(/\b(PT|CV)\s+[A-Z]/i) && // No specific supplier name
    !q.match(/\b[A-Z]{2,}-[\w-]+\b/) // No specific lot number
  );

  if (isAnalyticsQuestion) {
    // Skip entity extraction — go straight to analytics intent detection
    const intent = detectIntent(question, { type: 'NONE', name: null, validated: false, dbId: null });
    const data = await retrieveContext(intent, question, { type: 'NONE', name: null, validated: false, dbId: null });
    const context: ManufacturingContext = { intent, question, data };
    const provider = getAIProvider();
    return provider.analyze(context);
  }

  // Step 1: Extract and validate entity
  const entity = await extractEntity(question);

  // Step 2: If entity referenced but NOT found — return clear "not found" response
  if (entity.type !== 'NONE' && !entity.validated) {
    return {
      summary: `I could not find ${entity.type === 'SUPPLIER' ? 'a supplier' : 'a lot'} named "${entity.name}" in the manufacturing database.`,
      confidence: 100,
      riskLevel: 'LOW',
      intent: entity.type === 'SUPPLIER' ? 'SUPPLIER_RISK' : 'QC_ANALYSIS',
      dataQuality: { confidence: 'HIGH', sampleSize: 0, dataQuality: 'LIMITED', note: 'Entity not found in database.' },
      evidence: [`No record found for "${entity.name}" in the system.`],
      recommendations: [
        'Verify the entity name is spelled correctly.',
        'Check if the entity exists in the system.',
        `Available suppliers can be viewed at GET /suppliers.`,
      ],
      relatedEntities: { suppliers: [], lots: [], productionBatches: [], inventory: [] },
    };
  }

  // Step 3: Detect intent (entity-aware)
  const intent = detectIntent(question, entity);

  // Step 4: Retrieve relevant context from database
  const data = await retrieveContext(intent, question, entity);

  // Step 5: Build manufacturing context for provider
  const context: ManufacturingContext = { intent, question, data };

  // Step 6: Get AI provider and generate analysis
  const provider = getAIProvider();
  const result = await provider.analyze(context);

  // Step 7: Ensure dataQuality is always present
  if (!result.dataQuality) {
    const sampleSize: number = Object.values(data).reduce<number>((sum, v) => {
      if (Array.isArray(v)) return sum + v.length;
      if (v && typeof v === 'object' && 'totalInspections' in (v as Record<string, unknown>)) return sum + (Number((v as Record<string, unknown>).totalInspections) || 0);
      return sum;
    }, 0);
    result.dataQuality = assessDataQuality(sampleSize || 1);
  }

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
