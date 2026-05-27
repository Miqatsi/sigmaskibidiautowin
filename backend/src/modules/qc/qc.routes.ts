import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './qc.controller';

const router = Router();

router.use(authenticate);

// QC and Admin can create/update inspections
router.post('/', authorize('Admin', 'QC'), controller.create);
router.patch('/:id', authorize('Admin', 'QC'), controller.update);

// All operational roles can view
router.get('/', authorize('Admin', 'QC', 'Warehouse', 'Production', 'Manager'), controller.getAll);
router.get('/:id', authorize('Admin', 'QC', 'Warehouse', 'Production', 'Manager'), controller.getById);

export default router;
