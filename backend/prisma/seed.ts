/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ============================================================
 * Sima Arome — Comprehensive Database Seed Script
 * ============================================================
 * Generates realistic manufacturing data for:
 * - AI Scheduling (20+ PLANNED orders for next 7 days)
 * - Traceability (10 completed orders with full lot genealogy)
 * - QC History (30+ lots with inspections)
 *
 * Usage: npx ts-node --transpile-only prisma/seed.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ============================================================
// HELPERS
// ============================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function futureDate(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(8, 0, 0, 0);
  return d;
}

function pastDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

async function main(): Promise<void> {
  console.log('🗑️  Clearing existing data...');

  // Delete in reverse-relational order to avoid FK constraints
  await prisma.auditLog.deleteMany();
  await prisma.sampleDispatch.deleteMany();
  await prisma.qCLog.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.productionBatchRawMaterial.deleteMany();
  await prisma.productionBatch.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.rawMaterialLot.deleteMany();
  await prisma.rawMaterial.deleteMany();
  await prisma.product.deleteMany();
  await prisma.storageLocation.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();

  console.log('✅ Database cleared.\n');
  console.log('🌱 Seeding fresh data...\n');

  // ============================================================
  // 1. ROLES & USERS
  // ============================================================

  console.log('👥 Creating roles & users...');

  const roles = await Promise.all(
    ['Admin', 'QC', 'Warehouse', 'Production', 'Manager'].map((name) =>
      prisma.role.create({ data: { name } })
    )
  );

  const roleMap: Record<string, string> = {};
  roles.forEach((r) => { roleMap[r.name] = r.id; });

  const hashedDefault = await bcrypt.hash('password123', 10);
  const hashedSigma = await bcrypt.hash('skibidi', 10);

  const usersData = [
    { username: 'sigma', email: 'sigma@sima.com', fullName: 'Sigma Admin', roleId: roleMap['Admin'], password: hashedSigma },
    { username: 'admin', email: 'admin@sima.com', fullName: 'System Admin', roleId: roleMap['Admin'], password: hashedDefault },
    { username: 'qc001', email: 'qc001@sima.com', fullName: 'Rina Wulandari (QC Inspector)', roleId: roleMap['QC'], password: hashedDefault },
    { username: 'qc002', email: 'qc002@sima.com', fullName: 'Budi Hartono (QC Senior)', roleId: roleMap['QC'], password: hashedDefault },
    { username: 'wh001', email: 'wh001@sima.com', fullName: 'Agus Prasetyo (Warehouse)', roleId: roleMap['Warehouse'], password: hashedDefault },
    { username: 'wh002', email: 'wh002@sima.com', fullName: 'Dewi Sartika (Warehouse)', roleId: roleMap['Warehouse'], password: hashedDefault },
    { username: 'prod001', email: 'prod001@sima.com', fullName: 'Hendra Gunawan (Operator)', roleId: roleMap['Production'], password: hashedDefault },
    { username: 'prod002', email: 'prod002@sima.com', fullName: 'Siti Aminah (Operator)', roleId: roleMap['Production'], password: hashedDefault },
    { username: 'manager', email: 'manager@sima.com', fullName: 'Ir. Bambang Sutrisno (PPIC Manager)', roleId: roleMap['Manager'], password: hashedDefault },
  ];

  const users: any[] = [];
  for (const u of usersData) {
    const user = await prisma.user.create({ data: u });
    users.push(user);
  }

  const adminUser = users[0];
  console.log(`   ${users.length} users created`);

  // ============================================================
  // 2. SUPPLIERS
  // ============================================================

  console.log('🏭 Creating suppliers...');

  const suppliersData = [
    { name: 'PT Essential Oil Indo', code: 'SUP-001', contactName: 'Andi Wijaya', phone: '081355566677', email: 'andi@essentialoil.co.id', address: 'Jl. Industri Raya No. 45, Surabaya' },
    { name: 'Global Botanicals Ltd', code: 'SUP-002', contactName: 'James Chen', phone: '081298765432', email: 'james@globalbotanicals.com', address: 'Jl. Rungkut Industri III/12, Surabaya' },
    { name: 'PT Aroma Nusantara', code: 'SUP-003', contactName: 'Budi Santoso', phone: '081234567890', email: 'budi@aromanusantara.id', address: 'Jl. Margomulyo No. 88, Surabaya' },
    { name: 'CV Bahan Kimia Jaya', code: 'SUP-004', contactName: 'Siti Rahayu', phone: '081377788899', email: 'siti@bahankimia.co.id', address: 'Jl. Dupak No. 22, Surabaya' },
    { name: 'PT Tropical Harvest', code: 'SUP-005', contactName: 'Made Wirawan', phone: '081244455566', email: 'made@tropicalharvest.id', address: 'Jl. Bypass Ngurah Rai, Bali' },
  ];

  const suppliers: any[] = [];
  for (const s of suppliersData) {
    const supplier = await prisma.supplier.create({ data: s });
    suppliers.push(supplier);
  }
  console.log(`   ${suppliers.length} suppliers created`);

  // ============================================================
  // 3. RAW MATERIALS
  // ============================================================

  console.log('📦 Creating raw materials...');

  const materialsData = [
    { name: 'Vanilla Beans (Grade A)', code: 'RM-001', unit: 'kg' },
    { name: 'Orange Essential Oil', code: 'RM-002', unit: 'liter' },
    { name: 'Coffee Extract Arabica', code: 'RM-003', unit: 'kg' },
    { name: 'Citric Acid (Food Grade)', code: 'RM-004', unit: 'kg' },
    { name: 'Ethanol 96%', code: 'RM-005', unit: 'liter' },
    { name: 'Mango Puree Concentrate', code: 'RM-006', unit: 'kg' },
    { name: 'Peppermint Leaves (Dried)', code: 'RM-007', unit: 'kg' },
    { name: 'Lemongrass Oil', code: 'RM-008', unit: 'liter' },
    { name: 'Cinnamon Bark Extract', code: 'RM-009', unit: 'kg' },
    { name: 'Coconut MCT Oil', code: 'RM-010', unit: 'liter' },
  ];

  const materials: any[] = [];
  for (const m of materialsData) {
    const material = await prisma.rawMaterial.create({ data: m });
    materials.push(material);
  }
  console.log(`   ${materials.length} raw materials created`);

  // ============================================================
  // 4. PRODUCTS (Finished Goods)
  // ============================================================

  console.log('🧴 Creating finished products...');

  const productsData = [
    { name: 'Vanilla Extract Premium 10x', code: 'FG-001', unit: 'bottle' },
    { name: 'Orange Flavour Concentrate', code: 'FG-002', unit: 'bottle' },
    { name: 'Coffee Aroma Oil', code: 'FG-003', unit: 'bottle' },
    { name: 'Mango Powder Natural', code: 'FG-004', unit: 'kg' },
    { name: 'Peppermint Essential Oil', code: 'FG-005', unit: 'bottle' },
  ];

  const products: any[] = [];
  for (const p of productsData) {
    const product = await prisma.product.create({ data: p });
    products.push(product);
  }
  console.log(`   ${products.length} products created`);

  // ============================================================
  // 5. WAREHOUSE & STORAGE LOCATIONS
  // ============================================================

  console.log('🏪 Creating warehouse & storage locations...');

  const warehouse = await prisma.warehouse.create({
    data: { name: 'Gudang Utama Sima Arome', code: 'WH-001', location: 'Lantai 1, Gedung Produksi' },
  });

  const locationsData = [
    { name: 'Rak A1 — Bahan Baku Kering', code: 'LOC-A1', warehouseId: warehouse.id },
    { name: 'Rak A2 — Bahan Baku Cair', code: 'LOC-A2', warehouseId: warehouse.id },
    { name: 'Rak B1 — Finished Goods', code: 'LOC-B1', warehouseId: warehouse.id },
    { name: 'Rak B2 — Finished Goods (Export)', code: 'LOC-B2', warehouseId: warehouse.id },
    { name: 'Cold Storage (-4°C to -20°C)', code: 'LOC-CS1', warehouseId: warehouse.id },
    { name: 'Quarantine Area', code: 'LOC-QA1', warehouseId: warehouse.id },
  ];

  const locations: any[] = [];
  for (const loc of locationsData) {
    const l = await prisma.storageLocation.create({ data: loc });
    locations.push(l);
  }
  console.log(`   1 warehouse + ${locations.length} storage locations created`);

  // ============================================================
  // 6. RAW MATERIAL LOTS + QC HISTORY (35 lots)
  // ============================================================

  console.log('📋 Creating raw material lots & QC inspections...');

  const qcNotes = {
    PASS: [
      'Visual inspection OK. No foreign matter detected.',
      'Colour within spec. Moisture content 8.2% (max 12%).',
      'Lab test passed. pH 4.5 within range (4.0-5.0).',
      'Organoleptic test passed. Aroma characteristic, no off-notes.',
      'Particle size within specification. No clumping observed.',
    ],
    FAIL: [
      'Moisture content 15.3% exceeds maximum 12%. Reject.',
      'Foreign matter detected (insect fragments). Reject.',
      'Colour significantly darker than reference standard.',
      'Off-odour detected — possible fermentation. Reject.',
      'Heavy metal test: Lead 0.8 ppm exceeds limit 0.5 ppm.',
    ],
    CONDITIONAL: [
      'Slight colour deviation. Acceptable for blending only.',
      'Moisture 11.8% — borderline. Use within 7 days.',
    ],
  };

  const lots: any[] = [];
  const statuses = ['APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'REJECTED', 'PENDING_QC'];

  for (let i = 1; i <= 35; i++) {
    const material = randomItem(materials);
    const supplier = randomItem(suppliers);
    const status = randomItem(statuses);
    const daysAgo = randomInt(1, 30);

    const lot = await prisma.rawMaterialLot.create({
      data: {
        lotNumber: `RM-LOT-${pad(i, 3)}`,
        materialId: material.id,
        supplierId: supplier.id,
        quantity: randomInt(20, 500),
        unit: material.unit,
        receivedAt: pastDate(daysAgo),
        expiryDate: futureDate(randomInt(30, 180)),
        status,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      },
    });
    lots.push(lot);

    // Create QC log for non-PENDING lots
    if (status !== 'PENDING_QC') {
      const result = status === 'APPROVED' ? 'PASS' : 'FAIL';
      const notes = randomItem(qcNotes[result]);

      await prisma.qCLog.create({
        data: {
          type: 'INCOMING',
          result,
          notes,
          rawMaterialLotId: lot.id,
          createdBy: users[2].id, // QC inspector
          updatedBy: users[2].id,
        },
      });
    }
  }

  const approvedLots = lots.filter((l) => l.status === 'APPROVED');
  const pendingLots = lots.filter((l) => l.status === 'PENDING_QC');
  const rejectedLots = lots.filter((l) => l.status === 'REJECTED');

  console.log(`   ${lots.length} lots created (${approvedLots.length} approved, ${rejectedLots.length} rejected, ${pendingLots.length} pending)`);

  // ============================================================
  // 7. PPIC SCHEDULING DATA — 20+ PLANNED orders for next 7 days
  // ============================================================

  console.log('📅 Creating PLANNED production orders (for AI scheduling)...');

  const plannedOrders: any[] = [];
  for (let i = 1; i <= 22; i++) {
    const product = randomItem(products);
    const daysFromNow = randomInt(1, 7);

    const order = await prisma.productionOrder.create({
      data: {
        orderNumber: `PO-2026-${pad(i, 3)}`,
        productId: product.id,
        quantity: randomInt(50, 500),
        unit: product.unit,
        status: 'PLANNED',
        plannedDate: futureDate(daysFromNow),
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      },
    });
    plannedOrders.push(order);
  }
  console.log(`   ${plannedOrders.length} PLANNED orders created (next 7 days)`);

  // ============================================================
  // 8. TRACEABILITY DATA — 10 COMPLETED orders with full genealogy
  // ============================================================

  console.log('🔗 Creating completed orders with traceability chain...');

  const fgLocation = locations.find((l: any) => l.code === 'LOC-B1')!;
  let completedCount = 0;

  for (let i = 1; i <= 10; i++) {
    const product = products[(i - 1) % products.length];
    const orderNum = `PO-HIST-${pad(i, 3)}`;
    const batchNum = `FG-BATCH-${pad(i, 3)}`;
    const quantity = randomInt(80, 300);
    const daysAgo = randomInt(3, 20);

    // Create completed production order
    const order = await prisma.productionOrder.create({
      data: {
        orderNumber: orderNum,
        productId: product.id,
        quantity,
        unit: product.unit,
        status: 'COMPLETED',
        plannedDate: pastDate(daysAgo + 2),
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      },
    });

    // Create production batch
    const batch = await prisma.productionBatch.create({
      data: {
        lotNumber: batchNum,
        orderId: order.id,
        quantity,
        unit: product.unit,
        status: 'COMPLETED',
        startedAt: pastDate(daysAgo),
        completedAt: pastDate(daysAgo - 1),
        createdBy: users[6].id, // Operator
        updatedBy: users[6].id,
      },
    });

    // Link 2-3 raw material lots to this batch (traceability!)
    const lotsToConsume = approvedLots.slice(i * 2, i * 2 + randomInt(2, 3));
    for (const rmLot of lotsToConsume) {
      await prisma.productionBatchRawMaterial.create({
        data: {
          batchId: batch.id,
          rawMaterialLotId: rmLot.id,
          quantityUsed: randomInt(10, 50),
          unit: rmLot.unit,
        },
      });
    }

    // Create QC log for the batch (FINAL inspection)
    await prisma.qCLog.create({
      data: {
        type: 'FINAL',
        result: 'PASS',
        notes: `Final QC passed. Batch ${batchNum} meets all specifications. Released for dispatch.`,
        batchId: batch.id,
        createdBy: users[3].id, // QC Senior
        updatedBy: users[3].id,
      },
    });

    // Create inventory transaction (finished goods IN)
    await prisma.inventoryTransaction.create({
      data: {
        type: 'IN',
        storageLocationId: fgLocation.id,
        batchId: batch.id,
        quantity,
        unit: product.unit,
        reference: `Production complete: ${batchNum}`,
        createdBy: users[4].id, // Warehouse
        updatedBy: users[4].id,
      },
    });

    completedCount++;
  }

  console.log(`   ${completedCount} completed orders with full traceability chain`);

  // ============================================================
  // 9. ADDITIONAL INVENTORY TRANSACTIONS (receiving raw materials)
  // ============================================================

  console.log('📥 Creating inventory receiving transactions...');

  const rmLocation = locations.find((l: any) => l.code === 'LOC-A1')!;
  let txCount = 0;

  for (const lot of approvedLots.slice(0, 15)) {
    await prisma.inventoryTransaction.create({
      data: {
        type: 'IN',
        storageLocationId: rmLocation.id,
        quantity: lot.quantity,
        unit: lot.unit,
        reference: `Receiving ${lot.lotNumber}`,
        createdBy: users[4].id,
        updatedBy: users[4].id,
      },
    });
    txCount++;
  }
  console.log(`   ${txCount} receiving transactions created`);

  // ============================================================
  // SUMMARY
  // ============================================================

  console.log('\n' + '='.repeat(60));
  console.log('  🌱 SEEDING COMPLETE!');
  console.log('='.repeat(60));
  console.log(`  Roles:              ${roles.length}`);
  console.log(`  Users:              ${users.length}`);
  console.log(`  Suppliers:          ${suppliers.length}`);
  console.log(`  Raw Materials:      ${materials.length}`);
  console.log(`  Products:           ${products.length}`);
  console.log(`  Warehouse:          1 + ${locations.length} locations`);
  console.log(`  Raw Material Lots:  ${lots.length} (${approvedLots.length} approved)`);
  console.log(`  QC Inspections:     ${lots.length - pendingLots.length + completedCount}`);
  console.log(`  PLANNED Orders:     ${plannedOrders.length} (for AI scheduling)`);
  console.log(`  COMPLETED Orders:   ${completedCount} (with traceability)`);
  console.log(`  Inventory Txns:     ${txCount + completedCount}`);
  console.log('='.repeat(60));
  console.log('\n  Login: sigma / skibidi (Admin)');
  console.log('  Test AI Schedule: POST /ai/schedule');
  console.log('  Test Traceability: GET /traceability/FG-BATCH-001\n');
}

main()
  .catch((e: unknown) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
