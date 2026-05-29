import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './traceability.controller';
import { recallSimulation, recallGraph } from './recall.controller';

const router = Router();

router.use(authenticate);

// Recall Impact Simulator — must be before /:lotNumber (more specific routes first)
router.get('/recall/:lotNumber/graph', authorize('Admin', 'QC', 'Manager'), recallGraph);
router.get('/recall/:lotNumber', authorize('Admin', 'QC', 'Manager'), recallSimulation);

// Standard traceability — single segment catch-all (MUST be last)
router.get('/:lotNumber', authorize('Admin', 'QC', 'Warehouse', 'Production', 'Manager'), controller.trace);

export default router;
