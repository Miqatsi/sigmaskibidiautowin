import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { requestLogger } from './middleware/requestLogger';
import authRoutes from './modules/auth/auth.routes';
import supplierRoutes from './modules/supplier/supplier.routes';
import materialRoutes from './modules/material/material.routes';
import lotRoutes from './modules/lot/lot.routes';
import qcRoutes from './modules/qc/qc.routes';
import productionRoutes from './modules/production/production.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import traceabilityRoutes from './modules/traceability/traceability.routes';

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Terlalu banyak request. Coba lagi nanti.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
});

app.use(generalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authLimiter, authRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/materials', materialRoutes);
app.use('/lots', lotRoutes);
app.use('/qc', qcRoutes);
app.use('/production', productionRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/traceability', traceabilityRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
});

export default app;
