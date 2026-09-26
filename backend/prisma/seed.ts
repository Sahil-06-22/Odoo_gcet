// Demo data mirroring the frontend's mock data. Idempotent-ish: wipes and reseeds.
// Stock is created by running real documents through the API's own code path (raw inserts + ledger),
// so the ledger and totals agree.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany(),
    prisma.adjustment.deleteMany(),
    prisma.operationLine.deleteMany(),
    prisma.operation.deleteMany(),
    prisma.stockLevel.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.location.deleteMany(),
    prisma.warehouse.deleteMany(),
    prisma.counter.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const hash = await bcrypt.hash('password123', 10);
  const manager = await prisma.user.create({
    data: { name: 'Priya Sharma', email: 'priya@stocksense.io', role: 'INVENTORY_MANAGER', passwordHash: hash },
  });
  await prisma.user.create({
    data: { name: 'Arun Kumar', email: 'arun@stocksense.io', role: 'WAREHOUSE_STAFF', passwordHash: hash },
  });

  const main = await prisma.warehouse.create({
    data: {
      name: 'Main Warehouse',
      shortCode: 'WH',
      address: '123 Industrial Park, Delhi',
      locations: { create: [
        { name: 'Stock 1', shortCode: 'Stock1' },
        { name: 'Stock 2', shortCode: 'Stock2' },
        { name: 'Rack A', shortCode: 'RackA' },
      ] },
    },
    include: { locations: true },
  });
  const south = await prisma.warehouse.create({
    data: { name: 'South Branch', shortCode: 'SB', address: '45 Logistics Hub, Mumbai', locations: { create: [{ name: 'Stock 1', shortCode: 'Stock1' }] } },
    include: { locations: true },
  });
  const stock1 = main.locations.find(l => l.shortCode === 'Stock1')!;

  const products = [
    { sku: 'DESK001', cost: 4500, name: 'Desk', category: 'Furniture', qty: 50, reorderThreshold: 10 },
    { sku: 'CHAIR001', cost: 1800, name: 'Chair', category: 'Furniture', qty: 35, reorderThreshold: 15 },
    { sku: 'TABLE001', cost: 3200, name: 'Table', category: 'Furniture', qty: 8, reorderThreshold: 10 },
    { sku: 'SHELF001', cost: 2400, name: 'Shelf Unit', category: 'Storage', qty: 0, reorderThreshold: 5 },
    { sku: 'LAMP001', cost: 650, name: 'Desk Lamp', category: 'Electronics', qty: 120, reorderThreshold: null },
    { sku: 'CABLE001', cost: 199, name: 'HDMI Cable', category: 'Electronics', qty: 3, reorderThreshold: 20 },
  ];
  for (const p of products) {
    const cat = await prisma.category.upsert({ where: { name: p.category }, create: { name: p.category }, update: {} });
    const created = await prisma.product.create({
      data: { sku: p.sku, name: p.name, categoryId: cat.id, unitOfMeasure: 'Units', reorderThreshold: p.reorderThreshold, unitCost: p.cost },
    });
    if (p.qty > 0) {
      await prisma.stockLevel.create({ data: { productId: created.id, locationId: stock1.id, quantity: p.qty } });
      await prisma.ledgerEntry.create({
        data: {
          productId: created.id, movementType: 'ADJUSTMENT', reference: 'INITIAL', fromLabel: 'initial stock',
          toLabel: 'WH/Stock1', quantity: p.qty, resultingQty: p.qty, actorId: manager.id,
        },
      });
    }
  }
  void south;
  console.log('Seeded. Logins: priya@stocksense.io (manager) / arun@stocksense.io (staff), password: password123');
}

main().finally(() => prisma.$disconnect());
