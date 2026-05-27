import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { traceLot } from './traceability.service';
import logger from '../../lib/logger';

/**
 * GET /traceability/:lotNumber
 * The killer feature — full lot genealogy from supplier to dispatch.
 */
export async function trace(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { lotNumber } = req.params;

    if (!lotNumber || lotNumber.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Lot number wajib diisi.' });
      return;
    }

    const result = await traceLot(lotNumber.trim());

    if (!result) {
      res.status(404).json({
        success: false,
        message: `Lot '${lotNumber}' tidak ditemukan di sistem.`,
      });
      return;
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, '[Traceability/Trace]');
    res.status(500).json({ success: false, message: 'Gagal melakukan traceability lookup.' });
  }
}
