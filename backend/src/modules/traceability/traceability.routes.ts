import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './traceability.controller';

const router = Router();

router.use(authenticate);

// All operational roles can trace lots — this is the core value
router.get('/:lotNumber', authorize('Admin', 'QC', 'Warehouse', 'Production', 'Manager'), controller.trace);

export default router;
