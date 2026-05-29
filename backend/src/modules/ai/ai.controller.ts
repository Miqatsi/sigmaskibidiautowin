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

// ============================================================
// PPIC AI SCHEDULING
// ============================================================

import * as schedulingService from './scheduling.service';

/**
 * POST /ai/schedule — Generate AI-assisted production schedule
 */
export async function generateSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const start = Date.now();
    const result = await schedulingService.generateSchedule();
    const duration = Date.now() - start;

    logger.info({ duration, totalOrders: result.summary.totalOrders }, '[AI/Schedule] Generated');

    res.status(200).json({
      success: true,
      data: result,
      processingTime: `${duration}ms`,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, '[AI/Schedule]');
    const message = error instanceof Error ? error.message : 'Schedule generation gagal.';
    res.status(500).json({ success: false, message });
  }
}

/**
 * POST /ai/schedule/approve — Approve AI schedule and push orders to IN_PROGRESS
 */
export async function approveSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({ success: false, message: 'orderIds array is required.' });
      return;
    }

    const userId = req.user!.id;
    const result = await schedulingService.approveSchedule(orderIds, userId);

    // Audit log
    await auditCreate(req, 'production_orders', 'BATCH_APPROVE', {
      orderIds,
      approved: result.approved,
    });

    logger.info({ approved: result.approved, userId }, '[AI/Schedule] Approved');

    res.status(200).json({
      success: true,
      data: result,
      message: `${result.approved} order(s) approved and pushed to production floor.`,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, '[AI/Schedule/Approve]');
    const message = error instanceof Error ? error.message : 'Approval gagal.';
    res.status(500).json({ success: false, message });
  }
}
