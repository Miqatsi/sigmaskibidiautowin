import { Router, Response } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { prisma } from '../../lib/prisma';
import { AuthenticatedRequest } from '../../types/express';
import logger from '../../lib/logger';
import { getWarehouseMap, recommendSlot, getColdChainStatus, getWarehouseHealth } from './warehouse-intelligence.service';

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


// ============================================================
// WAREHOUSE INTELLIGENCE ENDPOINTS
// ============================================================

/**
 * GET /warehouses/intelligence/map — Interactive warehouse floor map
 */
router.get('/intelligence/map', authorize('Admin', 'Warehouse', 'Manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await getWarehouseMap();
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, '[Warehouse/Map]');
    res.status(500).json({ success: false, message: 'Gagal mengambil warehouse map.' });
  }
});

/**
 * GET /warehouses/intelligence/health — Warehouse health score
 */
router.get('/intelligence/health', authorize('Admin', 'Warehouse', 'Manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await getWarehouseHealth();
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, '[Warehouse/Health]');
    res.status(500).json({ success: false, message: 'Gagal menghitung warehouse health.' });
  }
});

/**
 * GET /warehouses/intelligence/cold-chain — Cold chain monitoring
 */
router.get('/intelligence/cold-chain', authorize('Admin', 'Warehouse', 'Manager', 'QC'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await getColdChainStatus();
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, '[Warehouse/ColdChain]');
    res.status(500).json({ success: false, message: 'Gagal mengambil cold chain status.' });
  }
});

/**
 * GET /warehouses/intelligence/recommend-slot — Smart slot recommendation
 */
router.get('/intelligence/recommend-slot', authorize('Admin', 'Warehouse', 'Manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lotNumber = req.query.lotNumber as string | undefined;
    const data = await recommendSlot(lotNumber);
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, '[Warehouse/RecommendSlot]');
    res.status(500).json({ success: false, message: 'Gagal menghasilkan rekomendasi slot.' });
  }
});
