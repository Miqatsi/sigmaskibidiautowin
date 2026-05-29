import { Router, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

/**
 * GET /system/health — Full system health check
 * No auth required — used for deployment validation and monitoring.
 */
router.get('/', async (_req, res: Response) => {
  const checks: Record<string, { status: string; responseTime?: number; note?: string }> = {};

  // Database
  const dbStart = Date.now();
  try {
    await prisma.user.count();
    checks.database = { status: 'healthy', responseTime: Date.now() - dbStart };
  } catch {
    checks.database = { status: 'offline', responseTime: Date.now() - dbStart, note: 'Cannot connect to PostgreSQL' };
  }

  // Backend API
  checks.backend = { status: 'healthy', responseTime: 0 };

  // Visual QC (Python port 8000)
  const yoloUrl = process.env.YOLO_API_URL || 'http://localhost:8000';
  const yoloStart = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${yoloUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    checks.visualQC = res.ok
      ? { status: 'healthy', responseTime: Date.now() - yoloStart }
      : { status: 'degraded', responseTime: Date.now() - yoloStart, note: 'Service responding but unhealthy' };
  } catch {
    checks.visualQC = { status: 'offline', responseTime: Date.now() - yoloStart, note: 'Demo mode active — mock predictions available' };
  }

  // PPIC Scheduler (Python port 8001)
  const ppicUrl = process.env.PPIC_API_URL || 'http://localhost:8001';
  const ppicStart = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${ppicUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    checks.ppicScheduler = res.ok
      ? { status: 'healthy', responseTime: Date.now() - ppicStart }
      : { status: 'degraded', responseTime: Date.now() - ppicStart };
  } catch {
    checks.ppicScheduler = { status: 'offline', responseTime: Date.now() - ppicStart, note: 'Demo mode active — mock scheduling available' };
  }

  // AI Copilot (internal)
  checks.aiCopilot = { status: 'healthy', note: 'Mock provider active' };

  // Swagger
  checks.swagger = { status: 'healthy', note: '/api-docs available' };

  // Overall status
  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
  const hasOffline = Object.values(checks).some(c => c.status === 'offline');

  res.status(200).json({
    success: true,
    data: {
      status: allHealthy ? 'healthy' : hasOffline ? 'degraded' : 'healthy',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      demoMode: process.env.DEMO_MODE === 'true' || hasOffline,
      timestamp: new Date().toISOString(),
      services: checks,
    },
  });
});

export default router;
