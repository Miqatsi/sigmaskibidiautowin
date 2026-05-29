import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { CopilotQuerySchema } from './ai.schema';
import { analyzeQuestion, getManufacturingSummary } from './ai.service';
import { generateReport } from './report.service';
import { auditCreate } from '../../middleware/audit';
import logger from '../../lib/logger';

/**
 * POST /ai/copilot — Context-Aware AI Manufacturing Copilot
 * Flow: Question → Intent Detection → Context Retrieval → Evidence Builder → Response
 */
export async function copilot(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = CopilotQuerySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validasi gagal.',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { question } = parsed.data;
    const startTime = Date.now();

    // Generate context-aware AI analysis
    const result = await analyzeQuestion(question);

    const duration = Date.now() - startTime;

    // Audit log the AI query (best-effort)
    await auditCreate(
      req,
      'ai_queries',
      `copilot-${Date.now()}`,
      {
        question,
        intent: result.intent,
        confidence: result.confidence,
        riskLevel: result.riskLevel,
        duration: `${duration}ms`,
      },
      'best-effort'
    );

    logger.info(
      { question, intent: result.intent, confidence: result.confidence, duration: `${duration}ms`, user: req.user?.username },
      '[AI/Copilot] Query processed'
    );

    res.status(200).json({
      success: true,
      data: {
        ...result,
        processingTime: `${duration}ms`,
        provider: process.env.AI_PROVIDER || 'mock',
      },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, '[AI/Copilot]');
    const message = error instanceof Error ? error.message : 'AI analysis gagal.';
    res.status(500).json({ success: false, message });
  }
}

/**
 * GET /ai/summary — Manufacturing health summary for dashboard widget
 */
export async function summary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await getManufacturingSummary();
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, '[AI/Summary]');
    res.status(500).json({ success: false, message: 'Gagal mengambil manufacturing summary.' });
  }
}


/**
 * POST /ai/report — Generate Manufacturing Intelligence Report
 * Executive summary of current manufacturing operations.
 */
export async function report(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const startTime = Date.now();

    const data = await generateReport();

    const duration = Date.now() - startTime;

    // Audit log report generation
    await auditCreate(
      req,
      'ai_reports',
      `report-${Date.now()}`,
      { reportType: 'executive', plantHealthScore: data.plantHealthScore, risksCount: data.risks.length, duration: `${duration}ms` },
      'best-effort'
    );

    logger.info(
      { healthScore: data.plantHealthScore, risks: data.risks.length, duration: `${duration}ms`, user: req.user?.username },
      '[AI/Report] Manufacturing Intelligence Report generated'
    );

    res.status(200).json({
      success: true,
      data: { ...data, processingTime: `${duration}ms` },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, '[AI/Report]');
    const message = error instanceof Error ? error.message : 'Report generation gagal.';
    res.status(500).json({ success: false, message });
  }
}
