import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { CreateQCSchema, UpdateQCSchema } from './qc.schema';
import * as qcService from './qc.service';
import { auditCreate, auditUpdate } from '../../middleware/audit';
import logger from '../../lib/logger';

/**
 * POST /qc — Create QC inspection (auto-updates lot status)
 */
export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = CreateQCSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validasi gagal.', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const qcLog = await qcService.createQCLog(parsed.data, req.user!.id);

    await auditCreate(req, 'qc_logs', qcLog.id, qcLog as unknown as Record<string, unknown>, 'best-effort');

    res.status(201).json({ success: true, data: qcLog });
  } catch (error: unknown) {
    logger.error({ err: error }, '[QC/Create]');
    const message = error instanceof Error ? error.message : 'Gagal membuat QC log.';
    const status = message.includes('PENDING_QC') || message.includes('tidak ditemukan') ? 422 : 500;
    res.status(status).json({ success: false, message });
  }
}

/**
 * GET /qc — List QC logs with filters
 */
export async function getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const { type, result, rawMaterialLotId, batchId } = req.query as Record<string, string>;

    const data = await qcService.getQCLogs({ page, limit, type, result, rawMaterialLotId, batchId });
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    logger.error({ err: error }, '[QC/GetAll]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data QC.' });
  }
}

/**
 * GET /qc/:id — Get single QC log
 */
export async function getById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const qcLog = await qcService.getQCLogById(req.params.id);
    if (!qcLog) {
      res.status(404).json({ success: false, message: 'QC log tidak ditemukan.' });
      return;
    }
    res.status(200).json({ success: true, data: qcLog });
  } catch (error) {
    logger.error({ err: error }, '[QC/GetById]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data QC.' });
  }
}

/**
 * PATCH /qc/:id — Update QC log
 */
export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = UpdateQCSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validasi gagal.', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const result = await qcService.updateQCLog(req.params.id, parsed.data, req.user!.id);
    if (!result) {
      res.status(404).json({ success: false, message: 'QC log tidak ditemukan.' });
      return;
    }

    await auditUpdate(
      req, 'qc_logs', req.params.id,
      result.oldData as unknown as Record<string, unknown>,
      result.newData as unknown as Record<string, unknown>,
      'strict'
    );

    res.status(200).json({ success: true, data: result.newData });
  } catch (error: unknown) {
    logger.error({ err: error }, '[QC/Update]');
    const message = error instanceof Error ? error.message : 'Gagal mengupdate QC log.';
    res.status(500).json({ success: false, message });
  }
}
