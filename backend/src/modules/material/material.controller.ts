import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { CreateMaterialSchema, UpdateMaterialSchema } from './material.schema';
import * as materialService from './material.service';
import { auditCreate, auditUpdate, auditDelete } from '../../middleware/audit';
import logger from '../../lib/logger';

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = CreateMaterialSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validasi gagal.', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const material = await materialService.createMaterial(parsed.data, req.user!.id);
    await auditCreate(req, 'raw_materials', material.id, material as unknown as Record<string, unknown>);

    res.status(201).json({ success: true, data: material });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Material/Create]');
    const message = error instanceof Error ? error.message : 'Gagal membuat material.';
    res.status(500).json({ success: false, message });
  }
}

export async function getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await materialService.getMaterials(page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error }, '[Material/GetAll]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data material.' });
  }
}

export async function getById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const material = await materialService.getMaterialById(req.params.id);
    if (!material) {
      res.status(404).json({ success: false, message: 'Material tidak ditemukan.' });
      return;
    }
    res.status(200).json({ success: true, data: material });
  } catch (error) {
    logger.error({ err: error }, '[Material/GetById]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data material.' });
  }
}

export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = UpdateMaterialSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validasi gagal.', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const result = await materialService.updateMaterial(req.params.id, parsed.data, req.user!.id);
    if (!result) {
      res.status(404).json({ success: false, message: 'Material tidak ditemukan.' });
      return;
    }

    await auditUpdate(req, 'raw_materials', req.params.id, result.oldData as unknown as Record<string, unknown>, result.newData as unknown as Record<string, unknown>);
    res.status(200).json({ success: true, data: result.newData });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Material/Update]');
    const message = error instanceof Error ? error.message : 'Gagal mengupdate material.';
    res.status(500).json({ success: false, message });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const deleted = await materialService.deleteMaterial(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Material tidak ditemukan.' });
      return;
    }

    await auditDelete(req, 'raw_materials', req.params.id, deleted as unknown as Record<string, unknown>);
    res.status(200).json({ success: true, message: 'Material berhasil dihapus.' });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Material/Delete]');
    const message = error instanceof Error ? error.message : 'Gagal menghapus material.';
    res.status(500).json({ success: false, message });
  }
}
