import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { CreateTransactionSchema } from './inventory.schema';
import * as inventoryService from './inventory.service';
import { auditCreate } from '../../middleware/audit';
import logger from '../../lib/logger';

/**
 * POST /inventory/transactions — Record inventory movement
 */
export async function createTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = CreateTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validasi gagal.', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const tx = await inventoryService.createTransaction(parsed.data, req.user!.id);
    await auditCreate(req, 'inventory_transactions', tx.id, tx as unknown as Record<string, unknown>, 'strict');

    res.status(201).json({ success: true, data: tx });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Inventory/CreateTransaction]');
    const message = error instanceof Error ? error.message : 'Gagal mencatat transaksi inventory.';
    res.status(500).json({ success: false, message });
  }
}

/**
 * GET /inventory/transactions — Transaction history
 */
export async function getTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const { type, storageLocationId, batchId } = req.query as Record<string, string>;

    const result = await inventoryService.getTransactions({ page, limit, type, storageLocationId, batchId });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error }, '[Inventory/GetTransactions]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data transaksi.' });
  }
}

/**
 * GET /inventory/balance/:locationId — Current stock at location
 */
export async function getBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const balance = await inventoryService.getStockBalance(req.params.locationId);
    res.status(200).json({ success: true, data: balance });
  } catch (error) {
    logger.error({ err: error }, '[Inventory/GetBalance]');
    res.status(500).json({ success: false, message: 'Gagal menghitung stock balance.' });
  }
}
