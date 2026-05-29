import { Router, Response } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { generateAlerts, getAlertSummary } from './alerts.service';
import { AuthenticatedRequest } from '../../types/express';
import logger from '../../lib/logger';

const router = Router();

router.use(authenticate);

/**
 * GET /alerts — Full alert list with details
 */
router.get('/', authorize('Admin', 'Manager', 'QC', 'Warehouse', 'Production'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await generateAlerts();
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, '[Alerts/GetAll]');
    res.status(500).json({ success: false, message: 'Gagal mengambil alerts.' });
  }
});

/**
 * GET /alerts/summary — Lightweight count by severity
 */
router.get('/summary', authorize('Admin', 'Manager', 'QC', 'Warehouse', 'Production'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await getAlertSummary();
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, '[Alerts/Summary]');
    res.status(500).json({ success: false, message: 'Gagal mengambil alert summary.' });
  }
});

export default router;
