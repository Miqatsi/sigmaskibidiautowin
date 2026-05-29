import { prisma } from '../../lib/prisma';
import { AIAnalysisResult, CopilotIntent, ManufacturingContext } from './ai.schema';
import { getAIProvider } from './providers';
import { getSupplierContext } from './context/supplier.context';
import { getQCContext } from './context/qc.context';
import { getInventoryContext } from './context/inventory.context';
import { getProductionContext } from './context/production.context';

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

  // Entity-based intent detection
  if (entity.type === 'SUPPLIER') return 'SUPPLIER_RISK';
  if (entity.type === 'LOT' && (q.includes('fail') || q.includes('qc') || q.includes('reject') || q.includes('gagal'))) return 'QC_ANALYSIS';
  if (entity.type === 'LOT' && (q.includes('trace') || q.includes('contaminated') || q.includes('recall') || q.includes('impact'))) return 'TRACEABILITY';
  if (entity.type === 'LOT') return 'QC_ANALYSIS'; // Default for lot references

  // Keyword-based intent detection
  if (q.includes('supplier') && (q.includes('risk') || q.includes('rate') || q.includes('worst') || q.includes('best') || q.includes('perform') || q.includes('risky'))) return 'SUPPLIER_RISK';
  if (q.includes('qc') || q.includes('fail') || q.includes('inspect') || q.includes('quality') || q.includes('gagal') || q.includes('reject')) return 'QC_ANALYSIS';
  if (q.includes('inventory') || q.includes('warehouse') || q.includes('stock') || q.includes('vulnerable') || q.includes('quarantine') || q.includes('storage') || q.includes('expir')) return 'INVENTORY_RISK';
  if (q.includes('production') || q.includes('order') || q.includes('batch') || q.includes('blocked') || q.includes('delay') || q.includes('schedule')) return 'PRODUCTION_ANALYSIS';
  if (q.includes('trace') || q.includes('contaminated') || q.includes('affected') || q.includes('recall') || q.includes('impact') || q.includes('lacak')) return 'TRACEABILITY';

  return 'GENERAL';
}

// ============================================================
// CONTEXT RETRIEVAL
// ============================================================

async function retrieveContext(intent: CopilotIntent, question: string, entity: ExtractedEntity): Promise<Record<string, unknown>> {
  switch (intent) {
    case 'SUPPLIER_RISK':
      // Pass validated supplier name for specific lookup, or undefined for all
      return {
        supplier: await getSupplierContext(entity.validated ? entity.name! : undefined),
        entity,
      };

    case 'QC_ANALYSIS':
      return { qc: await getQCContext(entity.name || undefined), entity };

    case 'INVENTORY_RISK':
      return { inventory: await getInventoryContext(), entity };

    case 'PRODUCTION_ANALYSIS':
      return { production: await getProductionContext(), entity };

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
 * Flow: Question → Entity Extraction → Validation → Intent Detection → Context Retrieval → Analysis
 *
 * RULES:
 * - Never generate risk assessment for entities that don't exist
 * - Never fall back to generic summaries when a specific entity is referenced
 * - Every claim must come from the database
 */
export async function analyzeQuestion(question: string): Promise<AIAnalysisResult> {
  // Step 1: Extract and validate entity
  const entity = await extractEntity(question);

  // Step 2: If entity referenced but NOT found — return clear "not found" response
  if (entity.type !== 'NONE' && !entity.validated) {
    return {
      summary: `I could not find ${entity.type === 'SUPPLIER' ? 'a supplier' : 'a lot'} named "${entity.name}" in the manufacturing database.`,
      confidence: 100,
      riskLevel: 'LOW',
      intent: entity.type === 'SUPPLIER' ? 'SUPPLIER_RISK' : 'QC_ANALYSIS',
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
