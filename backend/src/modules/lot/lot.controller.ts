import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { CreateLotSchema, UpdateLotStatusSchema, LotStatusType } from './lot.schema';
import * as lotService from './lot.service';
import { auditCreate, auditUpdate } from '../../middleware/audit';
import logger from '../../lib/logger';

/**
 * POST /lots — Receive a new raw material lot
 */
export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = CreateLotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validasi gagal.', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const lot = await lotService.createLot(parsed.data, req.user!.id);
    await auditCreate(req, 'raw_material_lots', lot.id, lot as unknown as Record<string, unknown>);

    res.status(201).json({ success: true, data: lot });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Lot/Create]');
    const message = error instanceof Error ? error.message : 'Gagal membuat lot.';
    const status = message.includes('Unique constraint') ? 409 : 500;
    res.status(status).json({ success: false, message });
  }
}

/**
 * GET /lots — List lots with filters
 */
export async function getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as LotStatusType | undefined;
    const supplierId = req.query.supplierId as string | undefined;
    const materialId = req.query.materialId as string | undefined;

    const result = await lotService.getLots({ page, limit, status, supplierId, materialId });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error }, '[Lot/GetAll]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data lot.' });
  }
}

/**
 * GET /lots/:id — Get lot by ID
 */
export async function getById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const lot = await lotService.getLotById(req.params.id);
    if (!lot) {
      res.status(404).json({ success: false, message: 'Lot tidak ditemukan.' });
      return;
    }
    res.status(200).json({ success: true, data: lot });
  } catch (error) {
    logger.error({ err: error }, '[Lot/GetById]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data lot.' });
  }
}

/**
 * GET /lots/number/:lotNumber — Get lot by lot number (natural key lookup)
 */
export async function getByNumber(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const lot = await lotService.getLotByNumber(req.params.lotNumber);
    if (!lot) {
      res.status(404).json({ success: false, message: 'Lot tidak ditemukan.' });
      return;
    }
    res.status(200).json({ success: true, data: lot });
  } catch (error) {
    logger.error({ err: error }, '[Lot/GetByNumber]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data lot.' });
  }
}

/**
 * PATCH /lots/:id/status — Update lot status (critical operation)
 */
export async function updateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = UpdateLotStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validasi gagal.', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const result = await lotService.updateLotStatus(req.params.id, parsed.data.status, req.user!.id);
    if (!result) {
      res.status(404).json({ success: false, message: 'Lot tidak ditemukan.' });
      return;
    }

    // Strict audit — status change is critical
    await auditUpdate(
      req,
      'raw_material_lots',
      req.params.id,
      result.oldData as unknown as Record<string, unknown>,
      result.newData as unknown as Record<string, unknown>,
      'strict'
    );

    res.status(200).json({ success: true, data: result.newData });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Lot/UpdateStatus]');
    const message = error instanceof Error ? error.message : 'Gagal mengupdate status lot.';
    const status = message.includes('Transisi status') ? 422 : 500;
    res.status(status).json({ success: false, message });
  }
}
