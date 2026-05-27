import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './production.controller';

const router = Router();

router.use(authenticate);

// Orders
router.post('/orders', authorize('Admin', 'Production', 'Manager'), controller.createOrder);
router.get('/orders', authorize('Admin', 'Production', 'Manager', 'QC'), controller.getOrders);
router.patch('/orders/:id/status', authorize('Admin', 'Production', 'Manager'), controller.updateOrderStatus);

// Batches
router.post('/batches', authorize('Admin', 'Production'), controller.createBatch);
router.get('/batches', authorize('Admin', 'Production', 'Manager', 'QC'), controller.getBatches);
router.patch('/batches/:id/status', authorize('Admin', 'Production'), controller.updateBatchStatus);

export default router;
