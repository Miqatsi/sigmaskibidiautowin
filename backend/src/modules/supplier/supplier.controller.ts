import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { CreateSupplierSchema, UpdateSupplierSchema } from './supplier.schema';
import * as supplierService from './supplier.service';
import { auditCreate, auditUpdate, auditDelete } from '../../middleware/audit';
import logger from '../../lib/logger';

/**
 * POST /suppliers
 */
export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = CreateSupplierSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validasi gagal.',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const supplier = await supplierService.createSupplier(parsed.data, req.user!.id);

    await auditCreate(req, 'suppliers', supplier.id, supplier as unknown as Record<string, unknown>);

    res.status(201).json({ success: true, data: supplier });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Supplier/Create]');
    const message = error instanceof Error ? error.message : 'Gagal membuat supplier.';
    res.status(500).json({ success: false, message });
  }
}

/**
 * GET /suppliers
 */
export async function getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await supplierService.getSuppliers(page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error }, '[Supplier/GetAll]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data supplier.' });
  }
}

/**
 * GET /suppliers/:id
 */
export async function getById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const supplier = await supplierService.getSupplierById(req.params.id);
    if (!supplier) {
      res.status(404).json({ success: false, message: 'Supplier tidak ditemukan.' });
      return;
    }
    res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    logger.error({ err: error }, '[Supplier/GetById]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data supplier.' });
  }
}

/**
 * PATCH /suppliers/:id
 */
export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = UpdateSupplierSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validasi gagal.',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await supplierService.updateSupplier(req.params.id, parsed.data, req.user!.id);
    if (!result) {
      res.status(404).json({ success: false, message: 'Supplier tidak ditemukan.' });
      return;
    }

    await auditUpdate(
      req,
      'suppliers',
      req.params.id,
      result.oldData as unknown as Record<string, unknown>,
      result.newData as unknown as Record<string, unknown>
    );

    res.status(200).json({ success: true, data: result.newData });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Supplier/Update]');
    const message = error instanceof Error ? error.message : 'Gagal mengupdate supplier.';
    res.status(500).json({ success: false, message });
  }
}

/**
 * DELETE /suppliers/:id (soft-delete)
 */
export async function remove(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const deleted = await supplierService.deleteSupplier(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Supplier tidak ditemukan.' });
      return;
    }

    await auditDelete(req, 'suppliers', req.params.id, deleted as unknown as Record<string, unknown>);

    res.status(200).json({ success: true, message: 'Supplier berhasil dihapus.' });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Supplier/Delete]');
    const message = error instanceof Error ? error.message : 'Gagal menghapus supplier.';
    res.status(500).json({ success: false, message });
  }
}
