// Mock data for StockSense frontend (until backend is ready)
import type {
  DashboardKPIs,
  Product,
  Receipt,
  DeliveryOrder,
  InternalTransfer,
  StockAdjustment,
  LedgerEntry,
  Warehouse,
} from '../types';

export const mockKPIs: DashboardKPIs = {
  totalProducts: 248,
  lowStockItems: 12,
  outOfStockItems: 3,
  pendingReceipts: 4,
  pendingDeliveries: 7,
  scheduledTransfers: 2,
};

export const mockWarehouses: Warehouse[] = [
  {
    id: 'wh-1',
    name: 'Main Warehouse',
    shortCode: 'WH',
    address: '123 Industrial Park, Delhi',
    locations: [
      { id: 'loc-1', name: 'Stock 1', shortCode: 'Stock1', warehouseId: 'wh-1' },
      { id: 'loc-2', name: 'Stock 2', shortCode: 'Stock2', warehouseId: 'wh-1' },
      { id: 'loc-3', name: 'Rack A', shortCode: 'RackA', warehouseId: 'wh-1' },
    ],
  },
  {
    id: 'wh-2',
    name: 'South Branch',
    shortCode: 'SB',
    address: '45 Logistics Hub, Mumbai',
    locations: [
      { id: 'loc-4', name: 'Stock 1', shortCode: 'Stock1', warehouseId: 'wh-2' },
    ],
  },
];

export const mockProducts: Product[] = [
  { id: 'p1', sku: 'DESK001', name: 'Desk', category: 'Furniture', unitOfMeasure: 'Units', totalStock: 50, stockStatus: 'IN_STOCK', isActive: true, reorderThreshold: 10, createdAt: '2024-01-01' },
  { id: 'p2', sku: 'CHAIR001', name: 'Chair', category: 'Furniture', unitOfMeasure: 'Units', totalStock: 35, stockStatus: 'IN_STOCK', isActive: true, reorderThreshold: 15, createdAt: '2024-01-02' },
  { id: 'p3', sku: 'TABLE001', name: 'Table', category: 'Furniture', unitOfMeasure: 'Units', totalStock: 8, stockStatus: 'LOW_STOCK', isActive: true, reorderThreshold: 10, createdAt: '2024-01-03' },
  { id: 'p4', sku: 'SHELF001', name: 'Shelf Unit', category: 'Storage', unitOfMeasure: 'Units', totalStock: 0, stockStatus: 'OUT_OF_STOCK', isActive: true, reorderThreshold: 5, createdAt: '2024-01-04' },
  { id: 'p5', sku: 'LAMP001', name: 'Desk Lamp', category: 'Electronics', unitOfMeasure: 'Units', totalStock: 120, stockStatus: 'IN_STOCK', isActive: true, createdAt: '2024-01-05' },
  { id: 'p6', sku: 'CABLE001', name: 'HDMI Cable', category: 'Electronics', unitOfMeasure: 'Units', totalStock: 3, stockStatus: 'LOW_STOCK', isActive: true, reorderThreshold: 20, createdAt: '2024-01-06' },
];

export const mockReceipts: Receipt[] = [
  {
    id: 'r1',
    reference: 'WH/IN/0001',
    supplier: 'Azure Interior',
    warehouseId: 'wh-1',
    warehouseName: 'WH/Stock1',
    status: 'READY',
    scheduledDate: '2024-12-01',
    responsible: 'Priya Sharma',
    lines: [
      { id: 'rl1', productId: 'p1', productName: 'Desk', productSku: 'DESK001', expectedQty: 10, receivedQty: 6 },
    ],
    createdAt: '2024-11-28',
  },
  {
    id: 'r2',
    reference: 'WH/IN/0002',
    supplier: 'Azure Interior',
    warehouseId: 'wh-1',
    warehouseName: 'WH/Stock1',
    status: 'READY',
    scheduledDate: '2024-12-01',
    responsible: 'Arun Kumar',
    lines: [
      { id: 'rl2', productId: 'p2', productName: 'Chair', productSku: 'CHAIR001', expectedQty: 20, receivedQty: 20 },
    ],
    createdAt: '2024-11-29',
  },
  {
    id: 'r3',
    reference: 'WH/IN/0003',
    supplier: 'Sai Enterprises',
    warehouseId: 'wh-2',
    warehouseName: 'SB/Stock1',
    status: 'DRAFT',
    scheduledDate: '2024-12-05',
    responsible: 'Priya Sharma',
    lines: [],
    createdAt: '2024-12-01',
  },
];

export const mockDeliveries: DeliveryOrder[] = [
  {
    id: 'd1',
    reference: 'WH/OUT/0001',
    deliveryAddress: 'Client Site, Noida',
    contact: 'Azure Interior',
    sourceWarehouseId: 'wh-1',
    sourceWarehouseName: 'WH/Stock1',
    operationType: 'Delivery Orders',
    status: 'READY',
    scheduledDate: '2024-12-01',
    responsible: 'Arun Kumar',
    lines: [
      { id: 'dl1', productId: 'p1', productName: 'Desk', productSku: 'DESK001', quantity: 6 },
    ],
    createdAt: '2024-11-28',
  },
  {
    id: 'd2',
    reference: 'WH/OUT/0002',
    deliveryAddress: 'Client Site, Gurugram',
    contact: 'Azure Interior',
    sourceWarehouseId: 'wh-1',
    sourceWarehouseName: 'WH/Stock1',
    operationType: 'Delivery Orders',
    status: 'READY',
    scheduledDate: '2024-12-02',
    responsible: 'Priya Sharma',
    lines: [
      { id: 'dl2', productId: 'p2', productName: 'Chair', productSku: 'CHAIR001', quantity: 15 },
    ],
    createdAt: '2024-11-29',
  },
];

export const mockTransfers: InternalTransfer[] = [
  {
    id: 't1',
    reference: 'WH/INT/0001',
    sourceLocationId: 'loc-1',
    sourceLocationName: 'WH/Stock1',
    destLocationId: 'loc-3',
    destLocationName: 'WH/RackA',
    contact: 'Internal',
    status: 'READY',
    scheduledDate: '2024-12-02',
    lines: [
      { id: 'tl1', productId: 'p1', productName: 'Desk', productSku: 'DESK001', quantity: 5 },
    ],
    createdAt: '2024-12-01',
  },
];

export const mockAdjustments: StockAdjustment[] = [
  {
    id: 'a1',
    reference: 'WH/ADJ/0001',
    productId: 'p3',
    productName: 'Table',
    locationId: 'loc-1',
    locationName: 'WH/Stock1',
    recordedQty: 10,
    countedQty: 8,
    difference: -2,
    reason: 'Physical count discrepancy after warehouse reorganization.',
    status: 'DONE',
    createdAt: '2024-11-30',
  },
];

export const mockLedger: LedgerEntry[] = [
  { id: 'l1', date: '12/1/2001', product: 'Desk', productSku: 'DESK001', from: 'vendor', to: 'WH/Stock1', contact: 'Azure Interior', quantity: 6, movementType: 'RECEIPT', status: 'READY', reference: 'WH/IN/0001', actor: 'Priya Sharma', resultingQty: 56 },
  { id: 'l2', date: '12/1/2001', product: 'Chair', productSku: 'CHAIR001', from: 'WH/Stock1', to: 'vendor', contact: 'Azure Interior', quantity: -15, movementType: 'DELIVERY', status: 'READY', reference: 'WH/OUT/0002', actor: 'Arun Kumar', resultingQty: 20 },
  { id: 'l3', date: '12/1/2001', product: 'Desk', productSku: 'DESK001', from: 'WH/Stock2', to: 'vendor', contact: 'Azure Interior', quantity: -3, movementType: 'DELIVERY', status: 'READY', reference: 'WH/OUT/0002', actor: 'Arun Kumar', resultingQty: 47 },
];
