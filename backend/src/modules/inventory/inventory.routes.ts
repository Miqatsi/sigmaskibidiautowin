import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './inventory.controller';

const router = Router();

router.use(authenticate);

router.post('/transactions', authorize('Admin', 'Warehouse'), controller.createTransaction);
router.get('/transactions', authorize('Admin', 'Warehouse', 'Production', 'Manager'), controller.getTransactions);
router.get('/balance/:locationId', authorize('Admin', 'Warehouse', 'Manager'), controller.getBalance);

export default router;
