import { z } from 'zod';

export const CopilotQuerySchema = z.object({
  question: z.string().min(3, 'Pertanyaan minimal 3 karakter').max(1000, 'Pertanyaan maksimal 1000 karakter'),
});

export type CopilotQueryInput = z.infer<typeof CopilotQuerySchema>;

// ============================================================
// INTENT DETECTION
// ============================================================

export type CopilotIntent =
  | 'SUPPLIER_RISK'
  | 'SUPPLIER_ANALYTICS'
  | 'QC_ANALYSIS'
  | 'QC_ANALYTICS'
  | 'INVENTORY_RISK'
  | 'INVENTORY_ANALYTICS'
  | 'PRODUCTION_ANALYSIS'
  | 'PRODUCTION_ANALYTICS'
  | 'RISK_ANALYTICS'
  | 'TRACEABILITY'
  | 'GENERAL';

// ============================================================
// CONTEXT-AWARE RESPONSE FORMAT
// ============================================================

export interface AIAnalysisResult {
  summary: string;
  confidence: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  intent: CopilotIntent;
  evidence: string[];
  recommendations: string[];
  relatedEntities: {
    suppliers: Array<{ id: string; name: string; code: string }>;
    lots: Array<{ id: string; lotNumber: string; status: string }>;
    productionBatches: Array<{ id: string; lotNumber: string; status: string }>;
    inventory: Array<{ id: string; location: string; type: string; quantity: number }>;
  };
  // Legacy fields for backward compatibility
  rootCauses?: string[];
  affectedLots?: string[];
  affectedBatches?: string[];
  supplierAnalysis?: { supplier: string; failureRate: number; totalInspections: number; failedLots: string[] };
}

// ============================================================
// AI PROVIDER INTERFACE (LLM-ready)
// ============================================================

export interface ManufacturingContext {
  intent: CopilotIntent;
  question: string;
  data: Record<string, unknown>;
}

export interface AIProvider {
  analyze(context: ManufacturingContext): Promise<AIAnalysisResult>;
}
