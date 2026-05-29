import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ============================================================
// REALISTIC MANUFACTURING DEMO DATA
// ~500 interconnected records for AI analysis demonstration
// ============================================================

const SUPPLIERS = [
  { name: 'PT Aroma Premium', code: 'SUP-AP', contactName: 'Budi Hartono', phone: '081234500001', profile: 'premium' },
  { name: 'PT Essential Indonesia', code: 'SUP-EI', contactName: 'Siti Nurhaliza', phone: '081234500002', profile: 'premium' },
  { name: 'PT Natural Extracts', code: 'SUP-NE', contactName: 'Ahmad Fauzi', phone: '081234500003', profile: 'average' },
  { name: 'PT Herbal Makmur', code: 'SUP-HM', contactName: 'Dewi Lestari', phone: '081234500004', profile: 'average' },
  { name: 'PT Bio Aroma', code: 'SUP-BA', contactName: 'Rudi Setiawan', phone: '081234500005', profile: 'average' },
  { name: 'PT Citrus Global', code: 'SUP-CG', contactName: 'Linda Wijaya', phone: '081234500006', profile: 'premium' },
  { name: 'PT Spice Nusantara', code: 'SUP-SN', contactName: 'Hendra Gunawan', phone: '081234500007', profile: 'average' },
  { name: 'PT Bahan Murah Jaya', code: 'SUP-BMJ', contactName: 'Agus Salim', phone: '081234500008', profile: 'risky' },
  { name: 'PT Sumber Ekstrak', code: 'SUP-SE', contactName: 'Yuni Astuti', phone: '081234500009', profile: 'risky' },
  { name: 'PT Aroma Nusantara', code: 'SUP-AN', contactName: 'Bambang Suryadi', phone: '081234500010', profile: 'premium' },
];

const MATERIALS = [
  { name: 'Orange Essential Oil', code: 'MAT-OEO', unit: 'liter' },
  { name: 'Lemon Oil Cold Pressed', code: 'MAT-LCP', unit: 'liter' },
  { name: 'Clove Bud Oil', code: 'MAT-CBO', unit: 'liter' },
  { name: 'Patchouli Oil', code: 'MAT-PAT', unit: 'liter' },
  { name: 'Citronella Oil', code: 'MAT-CIT', unit: 'liter' },
  { name: 'Ginger Extract CO2', code: 'MAT-GEC', unit: 'kg' },
  { name: 'Vanilla Oleoresin', code: 'MAT-VAN', unit: 'kg' },
  { name: 'Coffee Extract Arabica', code: 'MAT-CEA', unit: 'kg' },
  { name: 'Cinnamon Bark Oil', code: 'MAT-CIN', unit: 'liter' },
  { name: 'Peppermint Oil', code: 'MAT-PEP', unit: 'liter' },
  { name: 'Eucalyptus Oil', code: 'MAT-EUC', unit: 'liter' },
  { name: 'Tea Tree Oil', code: 'MAT-TTO', unit: 'liter' },
  { name: 'Lavender Oil', code: 'MAT-LAV', unit: 'liter' },
  { name: 'Rosemary Extract', code: 'MAT-ROS', unit: 'kg' },
  { name: 'Turmeric Oleoresin', code: 'MAT-TUR', unit: 'kg' },
];

const PRODUCTS = [
  { name: 'Orange Flavour Premium', code: 'FG-OFP', unit: 'bottle' },
  { name: 'Citrus Blend Extract', code: 'FG-CBE', unit: 'bottle' },
  { name: 'Vanilla Coffee Flavour', code: 'FG-VCF', unit: 'bottle' },
  { name: 'Herbal Wellness Oil', code: 'FG-HWO', unit: 'bottle' },
  { name: 'Spice Blend Concentrate', code: 'FG-SBC', unit: 'bottle' },
  { name: 'Mint Fresh Extract', code: 'FG-MFE', unit: 'bottle' },
  { name: 'Aromatherapy Blend', code: 'FG-ARB', unit: 'bottle' },
  { name: 'Natural Preservative Mix', code: 'FG-NPM', unit: 'bottle' },
];

const QC_FAIL_REASONS = [
  'Moisture content exceeds 12% threshold (measured: 18.3%)',
  'Foreign material detected during visual inspection',
  'Color deviation beyond acceptable range (Delta E > 5)',
  'Microbial count exceeds specification (TPC > 1000 CFU/g)',
  'Packaging integrity compromised — seal failure',
  'Odor profile does not match reference standard',
  'Heavy metal content above regulatory limit (Pb > 0.5 ppm)',
  'Viscosity outside specification range',
];

const STORAGE_LOCATIONS = [
  { name: 'Warehouse A - Raw Materials', code: 'WH-A-RM' },
  { name: 'Warehouse A - Finished Goods', code: 'WH-A-FG' },
  { name: 'Cold Storage Unit 1', code: 'CS-01' },
  { name: 'Cold Storage Unit 2', code: 'CS-02' },
  { name: 'Quarantine Zone', code: 'QZ-01' },
];

function randomDate(daysAgo: number, daysRange: number): Date {
  return new Date(Date.now() - (daysAgo - Math.random() * daysRange) * 24 * 60 * 60 * 1000);
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

async function main() {
  console.log('🏭 Generating realistic manufacturing demo data...\n');

  // Get admin user
  const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
  const qcUser = await prisma.user.findFirst({ where: { username: 'qc001' } });
  if (!admin || !qcUser) throw new Error('Run base seed first (npx prisma db seed)');
  const adminId = admin.id;
  const qcId = qcUser.id;

  // --- SUPPLIERS ---
  const supplierRecords: Array<{ id: string; profile: string; name: string }> = [];
  for (const s of SUPPLIERS) {
    const rec = await prisma.supplier.upsert({
      where: { code: s.code },
      update: {},
      create: { name: s.name, code: s.code, contactName: s.contactName, phone: s.phone, createdBy: adminId, updatedBy: adminId },
    });
    supplierRecords.push({ id: rec.id, profile: s.profile, name: s.name });
  }
  console.log(`✅ ${supplierRecords.length} suppliers`);

  // --- MATERIALS ---
  const materialRecords: Array<{ id: string; unit: string }> = [];
  for (const m of MATERIALS) {
    const rec = await prisma.rawMaterial.upsert({
      where: { code: m.code },
      update: {},
      create: { name: m.name, code: m.code, unit: m.unit, createdBy: adminId, updatedBy: adminId },
    });
    materialRecords.push({ id: rec.id, unit: m.unit });
  }
  console.log(`✅ ${materialRecords.length} materials`);

  // --- PRODUCTS ---
  const productRecords: Array<{ id: string }> = [];
  for (const p of PRODUCTS) {
    const rec = await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: { name: p.name, code: p.code, unit: p.unit, createdBy: adminId, updatedBy: adminId },
    });
    productRecords.push({ id: rec.id });
  }
  console.log(`✅ ${productRecords.length} products`);

  // --- WAREHOUSE + LOCATIONS ---
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-MAIN' },
    update: {},
    create: { name: 'Main Manufacturing Facility', code: 'WH-MAIN', location: 'Cikarang Industrial Estate', createdBy: adminId, updatedBy: adminId },
  });

  const locationRecords: Array<{ id: string }> = [];
  for (const loc of STORAGE_LOCATIONS) {
    const rec = await prisma.storageLocation.upsert({
      where: { code: loc.code },
      update: {},
      create: { name: loc.name, code: loc.code, warehouseId: warehouse.id, createdBy: adminId, updatedBy: adminId },
    });
    locationRecords.push({ id: rec.id });
  }
  console.log(`✅ ${locationRecords.length} storage locations`);

  // --- RAW MATERIAL LOTS (100) ---
  const lotRecords: Array<{ id: string; lotNumber: string; supplierId: string; status: string; materialId: string }> = [];
  let lotCounter = 1;
  let qcFailCount = 0;
  let expiredCount = 0;
  let nearExpiryCount = 0;

  for (const supplier of supplierRecords) {
    // Determine lot count per supplier based on profile
    const lotCount = supplier.profile === 'premium' ? 15 : supplier.profile === 'average' ? 10 : 8;

    for (let i = 0; i < lotCount; i++) {
      const lotNum = `RM-2026-${String(lotCounter).padStart(3, '0')}`;
      const material = pick(materialRecords);
      const receivedAt = randomDate(60, 50);

      // Determine status based on supplier profile
      let status: string;
      let expiryDate: Date | null = null;
      const rand = Math.random();

      if (supplier.profile === 'risky' && rand < 0.35) {
        status = 'REJECTED';
      } else if (supplier.profile === 'average' && rand < 0.12) {
        status = 'REJECTED';
      } else if (supplier.profile === 'premium' && rand < 0.03) {
        status = 'REJECTED';
      } else if (rand < 0.15) {
        status = 'PENDING_QC';
      } else if (rand < 0.5) {
        status = 'CONSUMED';
      } else {
        status = 'APPROVED';
      }

      // Expiry scenarios
      if (expiredCount < 5 && status === 'APPROVED' && Math.random() < 0.15) {
        expiryDate = new Date(Date.now() - Math.floor(Math.random() * 5 + 1) * 24 * 60 * 60 * 1000);
        expiredCount++;
      } else if (nearExpiryCount < 10 && status === 'APPROVED' && Math.random() < 0.2) {
        expiryDate = new Date(Date.now() + Math.floor(Math.random() * 6 + 1) * 24 * 60 * 60 * 1000);
        nearExpiryCount++;
      } else if (Math.random() < 0.5) {
        expiryDate = new Date(Date.now() + Math.floor(Math.random() * 180 + 30) * 24 * 60 * 60 * 1000);
      }

      const quantity = Math.floor(Math.random() * 400 + 50);

      try {
        const lot = await prisma.rawMaterialLot.upsert({
          where: { lotNumber: lotNum },
          update: {},
          create: {
            lotNumber: lotNum, materialId: material.id, supplierId: supplier.id,
            quantity, unit: material.unit, status, receivedAt, expiryDate,
            createdBy: adminId, updatedBy: adminId,
          },
        });
        lotRecords.push({ id: lot.id, lotNumber: lotNum, supplierId: supplier.id, status, materialId: material.id });
        lotCounter++;
      } catch { lotCounter++; continue; }
    }
  }
  console.log(`✅ ${lotRecords.length} raw material lots`);

  // --- QC LOGS (100) ---
  let qcLogCount = 0;
  for (const lot of lotRecords) {
    if (qcLogCount >= 100) break;

    const isRejected = lot.status === 'REJECTED';
    const result = isRejected ? 'FAIL' : (Math.random() < 0.05 ? 'CONDITIONAL' : 'PASS');
    const notes = result === 'FAIL' ? pick(QC_FAIL_REASONS) : result === 'CONDITIONAL' ? 'Minor deviation — conditional approval with monitoring' : 'All parameters within specification. Approved.';

    if (result === 'FAIL') qcFailCount++;

    await prisma.qCLog.create({
      data: {
        type: 'INCOMING', result, rawMaterialLotId: lot.id, notes,
        createdBy: qcId, updatedBy: qcId, createdAt: randomDate(50, 45),
      },
    });
    qcLogCount++;
  }
  console.log(`✅ ${qcLogCount} QC logs (${qcFailCount} failures)`);

  // --- PRODUCTION ORDERS (40) ---
  const orderRecords: Array<{ id: string; status: string }> = [];
  for (let i = 1; i <= 40; i++) {
    const orderNum = `PO-2026-${String(i).padStart(3, '0')}`;
    const rand = Math.random();
    let status: string;
    if (rand < 0.6) status = 'COMPLETED';
    else if (rand < 0.8) status = 'IN_PROGRESS';
    else if (rand < 0.9) status = 'PLANNED';
    else status = 'PLANNED'; // "blocked" = planned with no materials

    try {
      const order = await prisma.productionOrder.upsert({
        where: { orderNumber: orderNum },
        update: {},
        create: {
          orderNumber: orderNum, productId: pick(productRecords).id,
          quantity: Math.floor(Math.random() * 500 + 50), unit: 'bottle',
          status, plannedDate: randomDate(30, 60),
          createdBy: adminId, updatedBy: adminId,
        },
      });
      orderRecords.push({ id: order.id, status });
    } catch { continue; }
  }
  console.log(`✅ ${orderRecords.length} production orders`);

  // --- PRODUCTION BATCHES (60) ---
  const batchRecords: Array<{ id: string; lotNumber: string }> = [];
  const consumedLots = lotRecords.filter(l => l.status === 'CONSUMED');
  const completedOrders = orderRecords.filter(o => o.status === 'COMPLETED' || o.status === 'IN_PROGRESS');

  for (let i = 1; i <= 60 && i <= completedOrders.length * 2; i++) {
    const batchNum = `PB-2026-${String(i).padStart(3, '0')}`;
    const order = completedOrders[i % completedOrders.length];
    const batchStatus = order.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS';

    try {
      const batch = await prisma.productionBatch.upsert({
        where: { lotNumber: batchNum },
        update: {},
        create: {
          lotNumber: batchNum, orderId: order.id,
          quantity: Math.floor(Math.random() * 200 + 30), unit: 'bottle',
          status: batchStatus,
          startedAt: randomDate(40, 35),
          completedAt: batchStatus === 'COMPLETED' ? randomDate(20, 15) : null,
          createdBy: adminId, updatedBy: adminId,
        },
      });
      batchRecords.push({ id: batch.id, lotNumber: batchNum });

      // Link consumed lots to batches (traceability chain)
      if (consumedLots.length > 0) {
        const lotToLink = consumedLots[i % consumedLots.length];
        try {
          await prisma.productionBatchRawMaterial.upsert({
            where: { batchId_rawMaterialLotId: { batchId: batch.id, rawMaterialLotId: lotToLink.id } },
            update: {},
            create: { batchId: batch.id, rawMaterialLotId: lotToLink.id, quantityUsed: Math.floor(Math.random() * 100 + 20), unit: lotToLink.materialId ? 'kg' : 'liter' },
          });
        } catch { /* duplicate link */ }
      }
    } catch { continue; }
  }
  console.log(`✅ ${batchRecords.length} production batches`);

  // --- INVENTORY TRANSACTIONS (150) ---
  let txCount = 0;
  const txTypes = ['IN', 'IN', 'IN', 'OUT', 'TRANSFER', 'SHIP', 'ADJUSTMENT'];

  for (let i = 0; i < 150; i++) {
    const type = pick(txTypes);
    const location = pick(locationRecords);
    const batch = batchRecords.length > 0 ? pick(batchRecords) : null;
    const qty = type === 'OUT' || type === 'SHIP' ? -(Math.floor(Math.random() * 50 + 10)) : Math.floor(Math.random() * 100 + 20);

    const refs: Record<string, string> = {
      IN: `Received from production batch ${batch?.lotNumber || 'N/A'}`,
      OUT: `Dispatched to Customer ${String.fromCharCode(65 + Math.floor(Math.random() * 10))}`,
      TRANSFER: `Internal transfer between zones`,
      SHIP: `Shipped to distributor — DO-${String(Math.floor(Math.random() * 9000 + 1000))}`,
      ADJUSTMENT: `Stock count adjustment — cycle count`,
    };

    try {
      await prisma.inventoryTransaction.create({
        data: {
          type, storageLocationId: location.id, batchId: batch?.id || null,
          quantity: qty, unit: 'bottle', reference: refs[type] || 'N/A',
          createdBy: adminId, updatedBy: adminId, createdAt: randomDate(45, 40),
        },
      });
      txCount++;
    } catch { continue; }
  }
  console.log(`✅ ${txCount} inventory transactions`);

  // --- SUMMARY ---
  const highRiskSuppliers = supplierRecords.filter(s => s.profile === 'risky');
  const rejectedLots = lotRecords.filter(l => l.status === 'REJECTED');
  const blockedOrders = orderRecords.filter(o => o.status === 'PLANNED');

  console.log('\n========================================');
  console.log('🎬 DEMO DATA GENERATION COMPLETE');
  console.log('========================================');
  console.log(`Suppliers:          ${supplierRecords.length}`);
  console.log(`Materials:          ${materialRecords.length}`);
  console.log(`Products:           ${productRecords.length}`);
  console.log(`Raw Material Lots:  ${lotRecords.length}`);
  console.log(`QC Logs:            ${qcLogCount} (${qcFailCount} failures)`);
  console.log(`Production Orders:  ${orderRecords.length}`);
  console.log(`Production Batches: ${batchRecords.length}`);
  console.log(`Inventory Txns:     ${txCount}`);
  console.log(`Expired Lots:       ${expiredCount}`);
  console.log(`Near-Expiry Lots:   ${nearExpiryCount}`);
  console.log(`High-Risk Suppliers: ${highRiskSuppliers.length} (${highRiskSuppliers.map(s => s.name).join(', ')})`);
  console.log(`Rejected Lots:      ${rejectedLots.length}`);
  console.log(`Blocked Orders:     ${blockedOrders.length}`);
  console.log('========================================');
  console.log('\n🔍 Demo queries to test:');
  console.log('  "Which supplier has the highest QC failure rate?"');
  console.log('  "Show supplier performance ranking"');
  console.log('  "Which production orders are blocked?"');
  console.log('  "Which inventory is most vulnerable?"');
  console.log('  "What are the top operational risks today?"');
  console.log('  "Why is PT Bahan Murah Jaya risky?"');
  console.log(`  GET /traceability/recall/${lotRecords.find(l => l.status === 'CONSUMED')?.lotNumber || 'RM-2026-001'}`);
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
