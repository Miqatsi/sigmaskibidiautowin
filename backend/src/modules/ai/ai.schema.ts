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
// DATA QUALITY ENGINE
// ============================================================

export type DataConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DataQuality {
  confidence: DataConfidence;
  sampleSize: number;
  dataQuality: 'LIMITED' | 'MODERATE' | 'COMPREHENSIVE';
  note?: string;
}

export function assessDataQuality(sampleSize: number): DataQuality {
  if (sampleSize <= 4) return { confidence: 'LOW', sampleSize, dataQuality: 'LIMITED', note: `Only ${sampleSize} record(s) analyzed — conclusions may not be statistically significant.` };
  if (sampleSize <= 19) return { confidence: 'MEDIUM', sampleSize, dataQuality: 'MODERATE' };
  return { confidence: 'HIGH', sampleSize, dataQuality: 'COMPREHENSIVE' };
}

// ============================================================
// ENTERPRISE RESPONSE FORMAT
// ============================================================

export interface BusinessImpact {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  affectedBatches?: number;
  affectedOrders?: number;
  affectedInventory?: number;
  affectedCustomers?: number;
  financialRisk?: string;
}

export interface RiskContributor {
  category: string;
  score: number;
  description: string;
}

export interface AIAnalysisResult {
  // Executive Summary
  summary: string;
  confidence: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  intent: CopilotIntent;

  // Data Quality
  dataQuality?: DataQuality;

  // Evidence & Explainability
  evidence: string[];
  rootCauses?: string[];

  // Business Impact
  businessImpact?: BusinessImpact;

  // Risk Breakdown
  riskContributors?: RiskContributor[];

  // Actionable Recommendations
  recommendations: string[];

  // Related Entities (for frontend linking)
  relatedEntities: {
    suppliers: Array<{ id: string; name: string; code: string }>;
    lots: Array<{ id: string; lotNumber: string; status: string }>;
    productionBatches: Array<{ id: string; lotNumber: string; status: string }>;
    inventory: Array<{ id: string; location: string; type: string; quantity: number }>;
  };

  // Supporting Metrics
  metrics?: Record<string, string | number>;

  // Legacy compatibility
  supplierAnalysis?: { supplier: string; failureRate: number; totalInspections: number; failedLots: string[] };
  affectedLots?: string[];
  affectedBatches?: string[];
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
