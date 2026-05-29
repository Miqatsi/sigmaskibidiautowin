import { z } from 'zod';

export const CopilotQuerySchema = z.object({
  question: z.string().min(3, 'Pertanyaan minimal 3 karakter').max(1000, 'Pertanyaan maksimal 1000 karakter'),
});

export type CopilotQueryInput = z.infer<typeof CopilotQuerySchema>;

/**
 * AI Provider interface — allows swapping between Mock, OpenAI, etc.
 */
export interface AIProvider {
  analyze(context: string, question: string): Promise<AIAnalysisResult>;
}

export interface AIAnalysisResult {
  summary: string;
  rootCauses?: string[];
  recommendations?: string[];
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedLots?: string[];
  affectedBatches?: string[];
  relatedQCLogs?: Array<{ id: string; result: string; lotNumber: string; date: string }>;
  supplierAnalysis?: { supplier: string; failureRate: number; totalInspections: number };
  metadata?: Record<string, unknown>;
}
