import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './material.controller';

const router = Router();

router.use(authenticate);

router.post('/', authorize('Admin', 'Warehouse'), controller.create);
router.get('/', authorize('Admin', 'Warehouse', 'QC', 'Production', 'Manager'), controller.getAll);
router.get('/:id', authorize('Admin', 'Warehouse', 'QC', 'Production', 'Manager'), controller.getById);
router.patch('/:id', authorize('Admin', 'Warehouse'), controller.update);
router.delete('/:id', authorize('Admin'), controller.remove);

export default router;
