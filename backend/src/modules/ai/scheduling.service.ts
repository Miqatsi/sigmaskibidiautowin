/**
 * ============================================================
 * PPIC AI Scheduling Service
 * ============================================================
 * Two scheduling modes:
 * 1. OR-Tools (optimal): Calls Python microservice with CP-SAT solver
 * 2. Rule-based (fallback): Works without Python service running
 *
 * The OR-Tools solver finds the mathematically optimal schedule.
 * Set SCHEDULER_URL=http://localhost:8001 in .env to enable it.
 */

import { prisma } from '../../lib/prisma';
import logger from '../../lib/logger';

// ============================================================
// INTERFACES
// ============================================================

export interface ScheduleItem {
  orderId: string;
  orderNumber: string;
  productName: string;
  productCode: string;
  quantity: number;
  unit: string;
  plannedDate: string;
  suggestedSlot: string;
  priority: number;
  aiReasoning: string;
  materialStatus: 'AVAILABLE' | 'LOW' | 'UNAVAILABLE';
  estimatedDuration: string;
  machineName?: string;
}

export interface ScheduleResult {
  success: boolean;
  schedule: ScheduleItem[];
  warnings: string[];
  summary: {
    totalOrders: number;
    scheduledOrders: number;
    blockedOrders: number;
    estimatedCompletionDate: string;
    makespan?: string;
    solverUsed: 'OR-Tools CP-SAT' | 'Rule-based heuristic';
  };
}

interface PlannedOrder {
  id: string;
  orderNumber: string;
  quantity: number;
  unit: string;
  plannedDate: Date;
  product: { id: string; name: string; code: string };
}

interface InventoryBalance {
  materialName: string;
  materialCode: string;
  totalAvailable: number;
  unit: string;
}

// OR-Tools microservice response types
interface ORToolsJob {
  order_id: string;
  order_number: string;
  product_name: string;
  quantity: number;
  unit: string;
  machine_id: string;
  machine_name: string;
  start_minute: number;
  end_minute: number;
  duration_minutes: number;
  start_time: string;
  end_time: string;
}

interface ORToolsResponse {
  success: boolean;
  solver_status: string;
  makespan_minutes: number;
  makespan_human: string;
  schedule: ORToolsJob[];
  utilization: Record<string, number>;
}

// ============================================================
// DATA FETCHING
// ============================================================

async function fetchPlannedOrders(): Promise<PlannedOrder[]> {
  const orders = await prisma.productionOrder.findMany({
    where: { status: 'PLANNED', deletedAt: null },
    include: { product: { select: { id: true, name: true, code: true } } },
    orderBy: { plannedDate: 'asc' },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    quantity: o.quantity,
    unit: o.unit,
    plannedDate: o.plannedDate,
    product: o.product,
  }));
}

async function fetchMaterialAvailability(): Promise<InventoryBalance[]> {
  const approvedLots = await prisma.rawMaterialLot.findMany({
    where: { status: 'APPROVED', deletedAt: null },
    include: { material: { select: { name: true, code: true } } },
  });

  const balanceMap = new Map<string, InventoryBalance>();
  for (const lot of approvedLots) {
    const key = lot.material.code;
    const existing = balanceMap.get(key);
    if (existing) {
      existing.totalAvailable += lot.quantity;
    } else {
      balanceMap.set(key, {
        materialName: lot.material.name,
        materialCode: lot.material.code,
        totalAvailable: lot.quantity,
        unit: lot.unit,
      });
    }
  }

  return Array.from(balanceMap.values());
}

// ============================================================
// OR-TOOLS SOLVER (calls Python microservice)
// ============================================================

const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:8001';

async function callORToolsSolver(orders: PlannedOrder[]): Promise<ORToolsResponse | null> {
  try {
    // Map orders to OR-Tools format
    const payload = {
      orders: orders.map((o, i) => ({
        id: o.id,
        order_number: o.orderNumber,
        product_name: o.product.name,
        quantity: o.quantity,
        unit: o.unit,
        duration_minutes: Math.max(60, Math.min(480, Math.ceil(o.quantity / 10) * 15)), // 15 min per 10 units, capped at 8 hours
        priority: i + 1,
        planned_date: o.plannedDate.toISOString().split('T')[0],
      })),
      machines: [
        { id: 'LINE-1', name: 'Production Line 1 (Extract)' },
        { id: 'LINE-2', name: 'Production Line 2 (Powder)' },
        { id: 'LINE-3', name: 'Production Line 3 (Oil)' },
      ],
      horizon_minutes: 8640, // 6 days (144 hours)
    };

    logger.info({ url: `${SCHEDULER_URL}/optimize-schedule`, orders: orders.length }, '[PPIC] Calling OR-Tools solver');

    const response = await fetch(`${SCHEDULER_URL}/optimize-schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, '[PPIC] OR-Tools service returned error');
      return null;
    }

    const result = await response.json() as ORToolsResponse;
    logger.info({ status: result.solver_status, makespan: result.makespan_human }, '[PPIC] OR-Tools solved');
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn({ error: msg }, '[PPIC] OR-Tools service unavailable, falling back to heuristic');
    return null;
  }
}

// ============================================================
// RULE-BASED FALLBACK
// ============================================================

function generateRuleBasedSchedule(
  orders: PlannedOrder[],
  inventory: InventoryBalance[]
): ScheduleResult {
  const warnings: string[] = [];
  const schedule: ScheduleItem[] = [];

  const sorted = [...orders].sort((a, b) => {
    const dateDiff = a.plannedDate.getTime() - b.plannedDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.product.code.localeCompare(b.product.code);
  });

  const slots = ['08:00', '12:00', '16:00'];
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  currentDate.setDate(currentDate.getDate() + 1);
  let slotIndex = 0;

  const totalMaterials = inventory.reduce((sum, m) => sum + m.totalAvailable, 0);

  for (let i = 0; i < sorted.length; i++) {
    const order = sorted[i];

    let materialStatus: 'AVAILABLE' | 'LOW' | 'UNAVAILABLE' = 'AVAILABLE';
    if (totalMaterials === 0) {
      materialStatus = 'UNAVAILABLE';
      warnings.push(`⚠️ ${order.orderNumber}: No raw materials available.`);
    } else if (totalMaterials < order.quantity) {
      materialStatus = 'LOW';
      warnings.push(`⚠️ ${order.orderNumber}: Low material stock.`);
    }

    const reasons: string[] = [];
    const daysUntilDue = Math.ceil((order.plannedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue <= 1) reasons.push('URGENT: Due within 24 hours');
    else if (daysUntilDue <= 3) reasons.push(`High priority: Due in ${daysUntilDue} days`);
    else reasons.push(`Scheduled ${daysUntilDue} days before deadline`);

    if (i > 0 && sorted[i - 1].product.code === order.product.code) {
      reasons.push('Grouped with previous order (same product, no changeover)');
    }
    if (materialStatus === 'AVAILABLE') reasons.push('Raw materials confirmed available');
    else if (materialStatus === 'LOW') reasons.push('⚠️ Low material stock');

    const slotTime = slots[slotIndex];
    const slotDate = new Date(currentDate);
    const suggestedSlot = `${slotDate.toISOString().split('T')[0]} ${slotTime}`;

    schedule.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      productName: order.product.name,
      productCode: order.product.code,
      quantity: order.quantity,
      unit: order.unit,
      plannedDate: order.plannedDate.toISOString().split('T')[0],
      suggestedSlot,
      priority: i + 1,
      aiReasoning: reasons.join('. '),
      materialStatus,
      estimatedDuration: '4 hours',
    });

    slotIndex++;
    if (slotIndex >= slots.length) {
      slotIndex = 0;
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  const blockedOrders = schedule.filter(s => s.materialStatus === 'UNAVAILABLE').length;

  return {
    success: true,
    schedule,
    warnings,
    summary: {
      totalOrders: orders.length,
      scheduledOrders: schedule.length - blockedOrders,
      blockedOrders,
      estimatedCompletionDate: schedule.length > 0 ? schedule[schedule.length - 1].suggestedSlot.split(' ')[0] : new Date().toISOString().split('T')[0],
      solverUsed: 'Rule-based heuristic',
    },
  };
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Generate optimized production schedule.
 * Tries OR-Tools first, falls back to rule-based if unavailable.
 */
export async function generateSchedule(): Promise<ScheduleResult> {
  const [orders, inventory] = await Promise.all([
    fetchPlannedOrders(),
    fetchMaterialAvailability(),
  ]);

  if (orders.length === 0) {
    return {
      success: true,
      schedule: [],
      warnings: ['No PLANNED orders found. Create production orders first.'],
      summary: { totalOrders: 0, scheduledOrders: 0, blockedOrders: 0, estimatedCompletionDate: new Date().toISOString().split('T')[0], solverUsed: 'Rule-based heuristic' },
    };
  }

  // Try OR-Tools solver first
  const orToolsResult = await callORToolsSolver(orders);

  if (orToolsResult && orToolsResult.success) {
    // Convert OR-Tools response to our format
    const totalMaterials = inventory.reduce((sum, m) => sum + m.totalAvailable, 0);

    const schedule: ScheduleItem[] = orToolsResult.schedule.map((job, i) => {
      const order = orders.find(o => o.id === job.order_id);
      let materialStatus: 'AVAILABLE' | 'LOW' | 'UNAVAILABLE' = 'AVAILABLE';
      if (totalMaterials === 0) materialStatus = 'UNAVAILABLE';
      else if (totalMaterials < job.quantity) materialStatus = 'LOW';

      return {
        orderId: job.order_id,
        orderNumber: job.order_number,
        productName: job.product_name,
        productCode: order?.product.code || '',
        quantity: job.quantity,
        unit: job.unit,
        plannedDate: order?.plannedDate.toISOString().split('T')[0] || '',
        suggestedSlot: job.start_time,
        priority: i + 1,
        aiReasoning: `Optimally scheduled on ${job.machine_name}. Makespan minimized by CP-SAT solver.`,
        materialStatus,
        estimatedDuration: `${job.duration_minutes} min`,
        machineName: job.machine_name,
      };
    });

    const warnings: string[] = [];
    if (orToolsResult.utilization) {
      Object.entries(orToolsResult.utilization).forEach(([machine, util]) => {
        if (util < 50) warnings.push(`⚠️ ${machine}: Low utilization (${util}%)`);
      });
    }

    return {
      success: true,
      schedule,
      warnings,
      summary: {
        totalOrders: orders.length,
        scheduledOrders: schedule.length,
        blockedOrders: 0,
        estimatedCompletionDate: orToolsResult.makespan_human,
        makespan: orToolsResult.makespan_human,
        solverUsed: 'OR-Tools CP-SAT',
      },
    };
  }

  // Fallback to rule-based
  logger.info('[PPIC] Using rule-based heuristic (OR-Tools unavailable)');
  return generateRuleBasedSchedule(orders, inventory);
}

/**
 * Approve schedule: move orders to IN_PROGRESS.
 */
export async function approveSchedule(orderIds: string[], userId: string): Promise<{ approved: number }> {
  let approved = 0;
  for (const orderId of orderIds) {
    try {
      await prisma.productionOrder.update({
        where: { id: orderId },
        data: { status: 'IN_PROGRESS', updatedBy: userId, version: { increment: 1 } },
      });
      approved++;
    } catch { /* skip */ }
  }
  return { approved };
}
