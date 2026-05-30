import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import { requestLogger } from './middleware/requestLogger';
import authRoutes from './modules/auth/auth.routes';
import supplierRoutes from './modules/supplier/supplier.routes';
import materialRoutes from './modules/material/material.routes';
import lotRoutes from './modules/lot/lot.routes';
import qcRoutes from './modules/qc/qc.routes';
import productionRoutes from './modules/production/production.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import traceabilityRoutes from './modules/traceability/traceability.routes';
import warehouseRoutes from './modules/warehouse/warehouse.routes';
import aiRoutes from './modules/ai/ai.routes';
import alertsRoutes from './modules/alerts/alerts.routes';
import healthRoutes from './modules/health/health.routes';

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['https://sigmaskibidiautowin.vercel.app', 'http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
}));

// Rate limiting
const isDev = process.env.NODE_ENV === 'development';
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 200,
  message: { success: false, message: 'Terlalu banyak request. Coba lagi nanti.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 20,
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
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Swagger API Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Sima Arome API Docs',
}));

// Routes
app.use('/auth', authLimiter, authRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/materials', materialRoutes);
app.use('/lots', lotRoutes);
app.use('/qc', qcRoutes);
app.use('/production', productionRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/traceability', traceabilityRoutes);
app.use('/warehouses', warehouseRoutes);
app.use('/ai', aiRoutes);
app.use('/alerts', alertsRoutes);
app.use('/system/health', healthRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
});

export default app;
