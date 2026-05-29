import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './ai.controller';

const router = Router();

router.use(authenticate);

// AI Copilot — all operational roles can ask questions
router.post('/copilot', authorize('Admin', 'QC', 'Warehouse', 'Production', 'Manager'), controller.copilot);

// Manufacturing Intelligence Report — management
router.post('/report', authorize('Admin', 'Manager'), controller.report);

// Manufacturing summary — dashboard widget
router.get('/summary', authorize('Admin', 'Manager', 'QC'), controller.summary);

// PPIC AI Scheduling
router.post('/schedule', authorize('Admin', 'Production', 'Manager'), controller.generateSchedule);
router.post('/schedule/approve', authorize('Admin', 'Production', 'Manager'), controller.approveSchedule);

export default router;
