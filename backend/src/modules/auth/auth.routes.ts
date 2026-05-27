import { Router } from 'express';
import { login, getProfile } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

// Public
router.post('/login', login);

// Protected
router.get('/profile', authenticate, getProfile);

export default router;
