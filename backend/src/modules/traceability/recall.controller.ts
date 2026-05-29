import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { simulateRecall, simulateRecallGraph } from './recall.service';
import { auditCreate } from '../../middleware/audit';
import logger from '../../lib/logger';

/**
 * GET /traceability/recall/:lotNumber
 * Simulate a contamination recall event and return full impact analysis.
 * Read-only — no database records modified.
 */
export async function recallSimulation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { lotNumber } = req.params;

    if (!lotNumber || lotNumber.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Lot number wajib diisi.' });
      return;
    }

    const result = await simulateRecall(lotNumber.trim());

    if (!result) {
      res.status(404).json({
        success: false,
        message: `Lot '${lotNumber}' tidak ditemukan. Tidak dapat melakukan simulasi recall.`,
      });
      return;
    }

    // Audit log recall simulation (strict — compliance critical)
    await auditCreate(
      req,
      'recall_simulations',
      `recall-${lotNumber}-${Date.now()}`,
      {
        action: 'RECALL_SIMULATION',
        lotNumber,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        affectedBatches: result.impact.affectedProductionBatches,
        affectedInventory: result.impact.affectedInventoryLocations,
        affectedCustomers: result.impact.affectedDispatches,
      },
      'strict'
    );

    logger.info(
      { lotNumber, riskScore: result.riskScore, riskLevel: result.riskLevel, batches: result.impact.affectedProductionBatches },
      '[Traceability/Recall] Simulation executed'
    );

    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Traceability/Recall]');
    const message = error instanceof Error ? error.message : 'Recall simulation gagal.';
    res.status(500).json({ success: false, message });
  }
}

/**
 * GET /traceability/recall/:lotNumber/graph
 * Return graph-friendly structure (nodes + edges) for frontend visualization.
 */
export async function recallGraph(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { lotNumber } = req.params;

    if (!lotNumber || lotNumber.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Lot number wajib diisi.' });
      return;
    }

    const result = await simulateRecallGraph(lotNumber.trim());

    if (!result) {
      res.status(404).json({
        success: false,
        message: `Lot '${lotNumber}' tidak ditemukan.`,
      });
      return;
    }

    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Traceability/RecallGraph]');
    const message = error instanceof Error ? error.message : 'Recall graph generation gagal.';
    res.status(500).json({ success: false, message });
  }
}
