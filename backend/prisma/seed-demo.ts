import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/**
 * Demo Seed — Creates a rich dataset covering ALL alert types and scenarios:
 * - QC failures (multiple)
 * - Supplier with high failure rate
 * - Near-expiry lots
 * - Expired lots
 * - Production orders (planned, in-progress, completed, blocked)
 * - Inventory movements (IN, OUT, TRANSFER)
 * - Full traceability chain for recall demo
 */
async function main() {
  console.log('🎬 Seeding demo scenario data...\n');

  // Get existing data
  const roles = await prisma.role.findMany();
  const adminRole = roles.find(r => r.name === 'Admin')!;
  const qcRole = roles.find(r => r.name === 'QC')!;

  // Get or create admin user
  const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
  const qcUser = await prisma.user.findFirst({ where: { username: 'qc001' } });
  const adminId = admin!.id;
  const qcId = qcUser!.id;

  // ============================================================
  // SUPPLIERS — one risky, one clean, one moderate
  // ============================================================
  const supplierRisky = await prisma.supplier.upsert({
    where: { code: 'SUP-RISKY' },
    update: {},
    create: { name: 'PT Bahan Murah Jaya', code: 'SUP-RISKY', contactName: 'Dodgy Dave', phone: '081000000001', createdBy: adminId, updatedBy: adminId },
  });

  const supplierClean = await prisma.supplier.upsert({
    where: { code: 'SUP-CLEAN' },
    update: {},
    create: { name: 'PT Premium Quality', code: 'SUP-CLEAN', contactName: 'Quality Quinn', phone: '081000000002', createdBy: adminId, updatedBy: adminId },
  });

  const supplierModerate = await prisma.supplier.upsert({
    where: { code: 'SUP-MOD' },
    update: {},
    create: { name: 'CV Sedang Saja', code: 'SUP-MOD', contactName: 'Average Andy', phone: '081000000003', createdBy: adminId, updatedBy: adminId },
  });

  console.log('✅ 3 demo suppliers created');

  // ============================================================
  // MATERIALS
  // ============================================================
  const matOrange = await prisma.rawMaterial.upsert({ where: { code: 'RM-ORANGE' }, update: {}, create: { name: 'Orange Essential Oil', code: 'RM-ORANGE', unit: 'liter', createdBy: adminId, updatedBy: adminId } });
  const matVanilla = await prisma.rawMaterial.upsert({ where: { code: 'RM-VANILLA' }, update: {}, create: { name: 'Vanilla Oleoresin', code: 'RM-VANILLA', unit: 'kg', createdBy: adminId, updatedBy: adminId } });
  const matEthanol = await prisma.rawMaterial.upsert({ where: { code: 'RM-ETHANOL' }, update: {}, create: { name: 'Ethanol 96%', code: 'RM-ETHANOL', unit: 'liter', createdBy: adminId, updatedBy: adminId } });

  console.log('✅ 3 demo materials created');

  // ============================================================
  // LOTS — various statuses and scenarios
  // ============================================================

  // Lot 1: APPROVED, from risky supplier (will be used in production)
  const lot1 = await prisma.rawMaterialLot.upsert({
    where: { lotNumber: 'RM-DEMO-001' },
    update: {},
    create: { lotNumber: 'RM-DEMO-001', materialId: matOrange.id, supplierId: supplierRisky.id, quantity: 500, unit: 'liter', status: 'APPROVED', createdBy: adminId, updatedBy: adminId },
  });

  // Lot 2: FAILED QC from risky supplier
  const lot2 = await prisma.rawMaterialLot.upsert({
    where: { lotNumber: 'RM-DEMO-002' },
    update: {},
    create: { lotNumber: 'RM-DEMO-002', materialId: matOrange.id, supplierId: supplierRisky.id, quantity: 300, unit: 'liter', status: 'REJECTED', createdBy: adminId, updatedBy: adminId },
  });

  // Lot 3: FAILED QC from risky supplier (another failure)
  const lot3 = await prisma.rawMaterialLot.upsert({
    where: { lotNumber: 'RM-DEMO-003' },
    update: {},
    create: { lotNumber: 'RM-DEMO-003', materialId: matVanilla.id, supplierId: supplierRisky.id, quantity: 100, unit: 'kg', status: 'REJECTED', createdBy: adminId, updatedBy: adminId },
  });

  // Lot 4: PENDING QC (stale — triggers alert)
  const lot4 = await prisma.rawMaterialLot.upsert({
    where: { lotNumber: 'RM-DEMO-004' },
    update: {},
    create: { lotNumber: 'RM-DEMO-004', materialId: matEthanol.id, supplierId: supplierModerate.id, quantity: 200, unit: 'liter', status: 'PENDING_QC', receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), createdBy: adminId, updatedBy: adminId },
  });

  // Lot 5: Near expiry (expires in 3 days)
  const lot5 = await prisma.rawMaterialLot.upsert({
    where: { lotNumber: 'RM-DEMO-005' },
    update: {},
    create: { lotNumber: 'RM-DEMO-005', materialId: matVanilla.id, supplierId: supplierClean.id, quantity: 50, unit: 'kg', status: 'APPROVED', expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), createdBy: adminId, updatedBy: adminId },
  });

  // Lot 6: Already expired
  const lot6 = await prisma.rawMaterialLot.upsert({
    where: { lotNumber: 'RM-DEMO-006' },
    update: {},
    create: { lotNumber: 'RM-DEMO-006', materialId: matEthanol.id, supplierId: supplierModerate.id, quantity: 80, unit: 'liter', status: 'APPROVED', expiryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), createdBy: adminId, updatedBy: adminId },
  });

  // Lot 7: Clean lot from clean supplier (CONSUMED in production)
  const lot7 = await prisma.rawMaterialLot.upsert({
    where: { lotNumber: 'RM-DEMO-007' },
    update: {},
    create: { lotNumber: 'RM-DEMO-007', materialId: matOrange.id, supplierId: supplierClean.id, quantity: 400, unit: 'liter', status: 'CONSUMED', createdBy: adminId, updatedBy: adminId },
  });

  // Lot 8: Another clean lot (APPROVED, ready for production)
  const lot8 = await prisma.rawMaterialLot.upsert({
    where: { lotNumber: 'RM-DEMO-008' },
    update: {},
    create: { lotNumber: 'RM-DEMO-008', materialId: matVanilla.id, supplierId: supplierClean.id, quantity: 150, unit: 'kg', status: 'APPROVED', createdBy: adminId, updatedBy: adminId },
  });

  console.log('✅ 8 demo lots created (approved, rejected, pending, expired, near-expiry, consumed)');

  // ============================================================
  // QC LOGS — failures and passes
  // ============================================================
  const qcData = [
    { type: 'INCOMING', result: 'PASS', rawMaterialLotId: lot1.id, notes: 'Visual OK. Lab test passed.' },
    { type: 'INCOMING', result: 'FAIL', rawMaterialLotId: lot2.id, notes: 'Moisture content 18% — exceeds 12% limit.' },
    { type: 'INCOMING', result: 'FAIL', rawMaterialLotId: lot3.id, notes: 'Color inconsistency detected. Possible contamination.' },
    { type: 'INCOMING', result: 'PASS', rawMaterialLotId: lot7.id, notes: 'All parameters within spec.' },
    { type: 'INCOMING', result: 'PASS', rawMaterialLotId: lot8.id, notes: 'Clean. No issues.' },
    { type: 'INCOMING', result: 'PASS', rawMaterialLotId: lot5.id, notes: 'Passed but note: near expiry.' },
  ];

  for (const qc of qcData) {
    await prisma.qCLog.create({
      data: { ...qc, createdBy: qcId, updatedBy: qcId },
    });
  }

  console.log('✅ 6 QC logs created (4 PASS, 2 FAIL)');

  // ============================================================
  // PRODUCTS
  // ============================================================
  const productOrange = await prisma.product.upsert({ where: { code: 'FG-ORANGE' }, update: {}, create: { name: 'Orange Flavour Premium', code: 'FG-ORANGE', unit: 'bottle', createdBy: adminId, updatedBy: adminId } });
  const productVanilla = await prisma.product.upsert({ where: { code: 'FG-VANILLA' }, update: {}, create: { name: 'Vanilla Extract Natural', code: 'FG-VANILLA', unit: 'bottle', createdBy: adminId, updatedBy: adminId } });

  console.log('✅ 2 demo products created');

  // ============================================================
  // PRODUCTION ORDERS — various statuses
  // ============================================================
  const order1 = await prisma.productionOrder.upsert({
    where: { orderNumber: 'PO-DEMO-001' },
    update: {},
    create: { orderNumber: 'PO-DEMO-001', productId: productOrange.id, quantity: 200, unit: 'bottle', status: 'COMPLETED', plannedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), createdBy: adminId, updatedBy: adminId },
  });

  const order2 = await prisma.productionOrder.upsert({
    where: { orderNumber: 'PO-DEMO-002' },
    update: {},
    create: { orderNumber: 'PO-DEMO-002', productId: productVanilla.id, quantity: 100, unit: 'bottle', status: 'IN_PROGRESS', plannedDate: new Date(), createdBy: adminId, updatedBy: adminId },
  });

  const order3 = await prisma.productionOrder.upsert({
    where: { orderNumber: 'PO-DEMO-003' },
    update: {},
    create: { orderNumber: 'PO-DEMO-003', productId: productOrange.id, quantity: 500, unit: 'bottle', status: 'PLANNED', plannedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), createdBy: adminId, updatedBy: adminId },
  });

  console.log('✅ 3 production orders (COMPLETED, IN_PROGRESS, PLANNED)');

  // ============================================================
  // PRODUCTION BATCHES — with material consumption
  // ============================================================
  const batch1 = await prisma.productionBatch.upsert({
    where: { lotNumber: 'FG-DEMO-001' },
    update: {},
    create: { lotNumber: 'FG-DEMO-001', orderId: order1.id, quantity: 200, unit: 'bottle', status: 'COMPLETED', completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), createdBy: adminId, updatedBy: adminId },
  });

  const batch2 = await prisma.productionBatch.upsert({
    where: { lotNumber: 'FG-DEMO-002' },
    update: {},
    create: { lotNumber: 'FG-DEMO-002', orderId: order2.id, quantity: 100, unit: 'bottle', status: 'IN_PROGRESS', createdBy: adminId, updatedBy: adminId },
  });

  // Link raw materials to batches
  await prisma.productionBatchRawMaterial.upsert({
    where: { batchId_rawMaterialLotId: { batchId: batch1.id, rawMaterialLotId: lot7.id } },
    update: {},
    create: { batchId: batch1.id, rawMaterialLotId: lot7.id, quantityUsed: 350, unit: 'liter' },
  });

  await prisma.productionBatchRawMaterial.upsert({
    where: { batchId_rawMaterialLotId: { batchId: batch1.id, rawMaterialLotId: lot1.id } },
    update: {},
    create: { batchId: batch1.id, rawMaterialLotId: lot1.id, quantityUsed: 100, unit: 'liter' },
  });

  await prisma.productionBatchRawMaterial.upsert({
    where: { batchId_rawMaterialLotId: { batchId: batch2.id, rawMaterialLotId: lot8.id } },
    update: {},
    create: { batchId: batch2.id, rawMaterialLotId: lot8.id, quantityUsed: 80, unit: 'kg' },
  });

  console.log('✅ 2 production batches with material links');

  // ============================================================
  // INVENTORY TRANSACTIONS
  // ============================================================
  const locations = await prisma.storageLocation.findMany();
  const loc1 = locations[0];
  const loc2 = locations[1] || locations[0];
  const loc3 = locations[2] || locations[0];

  const inventoryData = [
    { type: 'IN', storageLocationId: loc1.id, batchId: batch1.id, quantity: 200, unit: 'bottle', reference: 'Batch FG-DEMO-001 completed' },
    { type: 'TRANSFER', storageLocationId: loc2.id, batchId: batch1.id, quantity: 50, unit: 'bottle', reference: 'Transfer to cold storage' },
    { type: 'OUT', storageLocationId: loc1.id, batchId: batch1.id, quantity: -30, unit: 'bottle', reference: 'Dispatch to Customer Alpha' },
    { type: 'IN', storageLocationId: loc3.id, batchId: batch2.id, quantity: 50, unit: 'bottle', reference: 'Partial batch FG-DEMO-002' },
    { type: 'SHIP', storageLocationId: loc2.id, batchId: batch1.id, quantity: -20, unit: 'bottle', reference: 'Shipped to Customer Beta' },
  ];

  for (const tx of inventoryData) {
    await prisma.inventoryTransaction.create({
      data: { ...tx, createdBy: adminId, updatedBy: adminId },
    });
  }

  console.log('✅ 5 inventory transactions (IN, OUT, TRANSFER, SHIP)');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n🎬 DEMO SCENARIO READY!\n');
  console.log('Scenarios covered:');
  console.log('  🔴 Supplier "PT Bahan Murah Jaya" — 3 lots, 2 failed QC (67% failure rate)');
  console.log('  🟢 Supplier "PT Premium Quality" — 3 lots, 0 failures (clean)');
  console.log('  🟡 Lot RM-DEMO-004 — pending QC for 3 days (stale alert)');
  console.log('  🔴 Lot RM-DEMO-006 — EXPIRED (critical alert)');
  console.log('  🟡 Lot RM-DEMO-005 — expires in 3 days (expiry alert)');
  console.log('  🏭 Production: 1 completed, 1 in-progress, 1 planned');
  console.log('  📦 Inventory: 5 movements including SHIP (recall exposure)');
  console.log('  🔍 Recall demo: trace RM-DEMO-001 or FG-DEMO-001');
  console.log('\nTest commands:');
  console.log('  AI Copilot: "Why is PT Bahan Murah Jaya risky?"');
  console.log('  AI Copilot: "Why did lot RM-DEMO-002 fail QC?"');
  console.log('  Recall: GET /traceability/recall/RM-DEMO-001');
  console.log('  Alerts: GET /alerts');
  console.log('  Report: POST /ai/report');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
