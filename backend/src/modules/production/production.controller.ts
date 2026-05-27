import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { CreateOrderSchema, UpdateOrderStatusSchema, CreateBatchSchema, UpdateBatchStatusSchema } from './production.schema';
import * as productionService from './production.service';
import { auditCreate, auditUpdate } from '../../middleware/audit';
import logger from '../../lib/logger';

// === ORDERS ===

export async function createOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validasi gagal.', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const order = await productionService.createOrder(parsed.data, req.user!.id);
    await auditCreate(req, 'production_orders', order.id, order as unknown as Record<string, unknown>);

    res.status(201).json({ success: true, data: order });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Production/CreateOrder]');
    const message = error instanceof Error ? error.message : 'Gagal membuat production order.';
    res.status(500).json({ success: false, message });
  }
}

export async function getOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;

    const result = await productionService.getOrders({ page, limit, status });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error }, '[Production/GetOrders]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data production orders.' });
  }
}

export async function updateOrderStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = UpdateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validasi gagal.', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const result = await productionService.updateOrderStatus(req.params.id, parsed.data.status, req.user!.id);
    if (!result) {
      res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
      return;
    }

    await auditUpdate(req, 'production_orders', req.params.id, result.oldData as unknown as Record<string, unknown>, result.newData as unknown as Record<string, unknown>, 'strict');
    res.status(200).json({ success: true, data: result.newData });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Production/UpdateOrderStatus]');
    const message = error instanceof Error ? error.message : 'Gagal mengupdate status order.';
    res.status(500).json({ success: false, message });
  }
}

// === BATCHES ===

export async function createBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = CreateBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validasi gagal.', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const batch = await productionService.createBatch(parsed.data, req.user!.id);
    await auditCreate(req, 'production_batches', batch!.id, batch as unknown as Record<string, unknown>, 'strict');

    res.status(201).json({ success: true, data: batch });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Production/CreateBatch]');
    const message = error instanceof Error ? error.message : 'Gagal membuat production batch.';
    const status = message.includes('APPROVED') || message.includes('tidak ditemukan') ? 422 : 500;
    res.status(status).json({ success: false, message });
  }
}

export async function getBatches(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const { status, orderId } = req.query as Record<string, string>;

    const result = await productionService.getBatches({ page, limit, status, orderId });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error }, '[Production/GetBatches]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data production batches.' });
  }
}

export async function updateBatchStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = UpdateBatchStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validasi gagal.', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const result = await productionService.updateBatchStatus(req.params.id, parsed.data.status, req.user!.id);
    if (!result) {
      res.status(404).json({ success: false, message: 'Batch tidak ditemukan.' });
      return;
    }

    await auditUpdate(req, 'production_batches', req.params.id, result.oldData as unknown as Record<string, unknown>, result.newData as unknown as Record<string, unknown>, 'strict');
    res.status(200).json({ success: true, data: result.newData });
  } catch (error: unknown) {
    logger.error({ err: error }, '[Production/UpdateBatchStatus]');
    const message = error instanceof Error ? error.message : 'Gagal mengupdate status batch.';
    res.status(500).json({ success: false, message });
  }
}
