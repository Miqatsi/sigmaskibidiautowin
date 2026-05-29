import { Router, Response } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { prisma } from '../../lib/prisma';
import { AuthenticatedRequest } from '../../types/express';
import logger from '../../lib/logger';

const router = Router();

router.use(authenticate);

/**
 * GET /warehouses — List all warehouses with storage locations
 */
router.get('/', authorize('Admin', 'Warehouse', 'Production', 'Manager', 'QC'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { deletedAt: null },
      include: {
        storageLocations: {
          where: { deletedAt: null },
          select: { id: true, name: true, code: true },
        },
      },
    });
    res.status(200).json({ success: true, data: warehouses });
  } catch (error) {
    logger.error({ err: error }, '[Warehouse/GetAll]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data warehouse.' });
  }
});

/**
 * GET /warehouses/locations — List all storage locations (flat)
 */
router.get('/locations', authorize('Admin', 'Warehouse', 'Production', 'Manager', 'QC'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const locations = await prisma.storageLocation.findMany({
      where: { deletedAt: null },
      include: { warehouse: { select: { id: true, name: true, code: true } } },
    });
    res.status(200).json({ success: true, data: locations });
  } catch (error) {
    logger.error({ err: error }, '[Warehouse/GetLocations]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data storage locations.' });
  }
});

/**
 * GET /warehouses/products — List all products (needed for production orders)
 */
router.get('/products', authorize('Admin', 'Warehouse', 'Production', 'Manager', 'QC'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
    });
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    logger.error({ err: error }, '[Warehouse/GetProducts]');
    res.status(500).json({ success: false, message: 'Gagal mengambil data products.' });
  }
});

export default router;
