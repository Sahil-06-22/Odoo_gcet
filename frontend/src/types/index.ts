// Types for StockSense frontend

export type UserRole = 'INVENTORY_MANAGER' | 'WAREHOUSE_STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export type DocumentStatus = 'DRAFT' | 'WAITING' | 'READY' | 'DONE' | 'CANCELLED';
export type MovementType = 'RECEIPT' | 'DELIVERY' | 'INTERNAL_TRANSFER' | 'TRANSFER' | 'ADJUSTMENT';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  totalStock: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  isActive: boolean;
  reorderThreshold?: number;
  reorderQty?: number;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  shortCode: string;
  address: string;
  locations: Location[];
}

export interface Location {
  id: string;
  name: string;
  shortCode: string;
  warehouseId: string;
}

export interface LineItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  expectedQty?: number;
  receivedQty?: number;
  quantity?: number;
  isInsufficient?: boolean;
}

export type TransferLine = LineItem;

export interface Receipt {
  id: string;
  reference: string;
  supplier: string;
  warehouseId: string;
  warehouseName: string;
  status: DocumentStatus;
  scheduledDate: string;
  responsible: string;
  lines: LineItem[];
  createdAt: string;
}

export interface DeliveryOrder {
  id: string;
  reference: string;
  deliveryAddress: string;
  contact: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  operationType: string;
  status: DocumentStatus;
  scheduledDate: string;
  responsible: string;
  lines: LineItem[];
  createdAt: string;
}

export interface InternalTransfer {
  id: string;
  reference: string;
  sourceLocationId: string;
  sourceLocationName: string;
  destLocationId: string;
  destLocationName: string;
  contact: string;
  status: DocumentStatus;
  scheduledDate: string;
  lines: LineItem[];
  createdAt: string;
}

export interface StockAdjustment {
  id: string;
  reference: string;
  productId: string;
  productName: string;
  locationId: string;
  locationName: string;
  recordedQty: number;
  countedQty: number;
  difference: number;
  reason: string;
  status: DocumentStatus;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  product: string;
  productSku: string;
  from: string;
  to: string;
  contact: string;
  quantity: number;
  movementType: MovementType;
  status: DocumentStatus;
  reference: string;
  actor: string;
  resultingQty: number;
}

export interface DashboardKPIs {
  totalProducts: number;
  lowStockItems: number;
  outOfStockItems: number;
  pendingReceipts: number;
  pendingDeliveries: number;
  scheduledTransfers: number;
}

export interface FilterState {
  type?: string;
  status?: DocumentStatus;
  warehouse?: string;
  category?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
