import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './lot.controller';

const router = Router();

router.use(authenticate);

// Receive new lot — Warehouse or Admin
router.post('/', authorize('Admin', 'Warehouse'), controller.create);

// List & view — all operational roles
router.get('/', authorize('Admin', 'Warehouse', 'QC', 'Production', 'Manager'), controller.getAll);
router.get('/number/:lotNumber', authorize('Admin', 'Warehouse', 'QC', 'Production', 'Manager'), controller.getByNumber);
router.get('/:id', authorize('Admin', 'Warehouse', 'QC', 'Production', 'Manager'), controller.getById);

// Status change — QC approves/rejects, Production consumes
router.patch('/:id/status', authorize('Admin', 'QC', 'Production'), controller.updateStatus);

export default router;
