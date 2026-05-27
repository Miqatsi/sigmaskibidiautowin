/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log('Seeding database...');

  // --- Roles ---
  const roles = await Promise.all(
    ['Admin', 'QC', 'Warehouse', 'Production', 'Manager'].map((name: string) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  const adminRole = roles.find((r: any) => r.name === 'Admin')!;
  const qcRole = roles.find((r: any) => r.name === 'QC')!;
  const warehouseRole = roles.find((r: any) => r.name === 'Warehouse')!;
  const productionRole = roles.find((r: any) => r.name === 'Production')!;

  console.log(`${roles.length} roles created`);

  // --- Users ---
  const hashedPassword = await bcrypt.hash('password123', 10);
  const sigmaPassword = await bcrypt.hash('skibidi', 10);

  const users = [
    { username: 'sigma', email: 'sigma@sima.com', fullName: 'Sigma Admin', roleId: adminRole.id, password: sigmaPassword },
    { username: 'admin', email: 'admin@sima.com', fullName: 'System Admin', roleId: adminRole.id, password: hashedPassword },
    { username: 'qc001', email: 'qc001@sima.com', fullName: 'QC Inspector 1', roleId: qcRole.id, password: hashedPassword },
    { username: 'wh001', email: 'wh001@sima.com', fullName: 'Warehouse Staff 1', roleId: warehouseRole.id, password: hashedPassword },
    { username: 'prod001', email: 'prod001@sima.com', fullName: 'Production Operator 1', roleId: productionRole.id, password: hashedPassword },
  ];

  for (const user of users) {
    const { password: pw, ...userData } = user;
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: { ...userData, password: pw },
    });
  }

  console.log(`${users.length} users created`);

  // --- Suppliers ---
  const suppliers = [
    { name: 'PT Aroma Nusantara', code: 'SUP-001', contactName: 'Budi Santoso', phone: '081234567890' },
    { name: 'CV Bahan Kimia Jaya', code: 'SUP-002', contactName: 'Siti Rahayu', phone: '081298765432' },
    { name: 'PT Essential Oil Indo', code: 'SUP-003', contactName: 'Andi Wijaya', phone: '081355566677' },
  ];

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { code: supplier.code },
      update: {},
      create: supplier,
    });
  }

  console.log(`${suppliers.length} suppliers created`);

  // --- Raw Materials ---
  const materials = [
    { name: 'Orange Essential Oil', code: 'RM-001', unit: 'liter' },
    { name: 'Coffee Extract', code: 'RM-002', unit: 'kg' },
    { name: 'Vanilla Oleoresin', code: 'RM-003', unit: 'kg' },
    { name: 'Ethanol 96%', code: 'RM-004', unit: 'liter' },
    { name: 'Citric Acid', code: 'RM-005', unit: 'kg' },
  ];

  for (const material of materials) {
    await prisma.rawMaterial.upsert({
      where: { code: material.code },
      update: {},
      create: material,
    });
  }

  console.log(`${materials.length} raw materials created`);

  // --- Products ---
  const products = [
    { name: 'Orange Extract Premium', code: 'FG-001', unit: 'bottle' },
    { name: 'Coffee Flavour Concentrate', code: 'FG-002', unit: 'bottle' },
    { name: 'Vanilla Flavour Natural', code: 'FG-003', unit: 'bottle' },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: {},
      create: product,
    });
  }

  console.log(`${products.length} products created`);

  // --- Warehouses & Storage Locations ---
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-001' },
    update: {},
    create: { name: 'Gudang Utama', code: 'WH-001', location: 'Lantai 1, Gedung A' },
  });

  const storageLocations = [
    { name: 'Rak A1 - Bahan Baku', code: 'LOC-A1', warehouseId: warehouse.id },
    { name: 'Rak B1 - Finished Goods', code: 'LOC-B1', warehouseId: warehouse.id },
    { name: 'Cold Storage', code: 'LOC-CS1', warehouseId: warehouse.id },
  ];

  for (const loc of storageLocations) {
    await prisma.storageLocation.upsert({
      where: { code: loc.code },
      update: {},
      create: loc,
    });
  }

  console.log(`1 warehouse + ${storageLocations.length} storage locations created`);

  console.log('\nSeeding complete!');
}

main()
  .catch((e: unknown) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
