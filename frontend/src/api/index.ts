// Typed endpoint helpers. Pages should call these.
import { authRequest, del, get, patch, post, type Session } from './client';
import type {
  DashboardKPIs,
  DeliveryOrder,
  DocumentStatus,
  InternalTransfer,
  LedgerEntry,
  Product,
  Receipt,
  StockAdjustment,
  User,
  Warehouse,
  Location,
} from '../types';

export { ApiError } from './client';

interface DocFilters {
  status?: DocumentStatus;
  warehouseId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Receipts use expectedQty; deliveries/transfers use quantity (the API accepts either).
export interface LineInput {
  productId: string;
  expectedQty?: number;
  quantity?: number;
  receivedQty?: number;
}

// One set of CRUD + workflow calls per document kind.
function documents<T, C, U = Partial<C>>(base: string) {
  return {
    list: (f?: DocFilters) => get<T[]>(base, { ...f }),
    get: (id: string) => get<T>(`${base}/${id}`),
    create: (b: C) => post<T>(base, b),
    update: (id: string, b: U) => patch<T>(`${base}/${id}`, b),
    remove: (id: string) => del(`${base}/${id}`),
    confirm: (id: string) => post<T>(`${base}/${id}/confirm`),
    validate: (id: string, b?: { lines?: { id: string; receivedQty: number }[] }) => post<T>(`${base}/${id}/validate`, b),
    cancel: (id: string) => post<T>(`${base}/${id}/cancel`),
  };
}

export const receipts = documents<
  Receipt,
  { supplier: string; warehouseId?: string; locationId?: string; scheduledDate?: string; lines: LineInput[] },
  { supplier?: string; scheduledDate?: string; lines?: LineInput[] }
>('/receipts');

export const deliveries = documents<
  DeliveryOrder,
  { contact: string; deliveryAddress?: string; sourceWarehouseId?: string; sourceLocationId?: string; scheduledDate?: string; lines: LineInput[] },
  { contact?: string; deliveryAddress?: string; scheduledDate?: string; lines?: LineInput[] }
>('/deliveries');

export const transfers = documents<
  InternalTransfer,
  { sourceLocationId: string; destLocationId: string; contact?: string; scheduledDate?: string; lines: LineInput[] },
  { contact?: string; scheduledDate?: string; lines?: LineInput[] }
>('/transfers');

export interface ProductInput {
  name: string;
  sku: string;
  category: string;
  unitOfMeasure?: string;
  reorderThreshold?: number | null;
  reorderQty?: number | null;
  unitCost?: number | null;
  isActive?: boolean;
  initialStock?: number;
  locationId?: string;
}
export interface StockRow {
  productId: string;
  sku: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  locationId: string;
  locationName: string;
  warehouseId: string;
  quantity: number;
}

export const products = {
  list: (f?: { search?: string; category?: string; stockStatus?: Product['stockStatus']; includeInactive?: boolean }) =>
    get<Product[]>('/products', { ...f, includeInactive: f?.includeInactive ? 'true' : undefined }),
  get: (id: string) =>
    get<Product & { stockByLocation: { locationId: string; locationName: string; warehouseId: string; quantity: number }[] }>(`/products/${id}`),
  create: (b: ProductInput) => post<Product>('/products', b),
  update: (id: string, b: Partial<Omit<ProductInput, 'initialStock' | 'locationId'>>) => patch<Product>(`/products/${id}`, b),
  remove: (id: string) => del(`/products/${id}`),
  categories: () => get<{ id: string; name: string; productCount: number }[]>('/categories'),
  stock: (f?: { warehouseId?: string; locationId?: string; category?: string; search?: string }) => get<StockRow[]>('/stock', { ...f }),
};

export const warehouses = {
  list: () => get<Warehouse[]>('/warehouses'),
  create: (b: { name: string; shortCode: string; address?: string }) => post<Warehouse>('/warehouses', b),
  update: (id: string, b: { name?: string; address?: string }) => patch<Warehouse>(`/warehouses/${id}`, b),
  addLocation: (id: string, b: { name: string; shortCode: string }) => post<Location>(`/warehouses/${id}/locations`, b),
};

export const adjustments = {
  list: (f?: { productId?: string; locationId?: string }) => get<StockAdjustment[]>('/adjustments', { ...f }),
  recordedQty: (productId: string, locationId: string) =>
    get<{ recordedQty: number }>('/adjustments/recorded/qty', { productId, locationId }).then(r => r.recordedQty),
  create: (b: { productId: string; locationId: string; countedQty: number; reason?: string }) => post<StockAdjustment>('/adjustments', b),
};

export const ledger = {
  list: (f?: { type?: string; status?: DocumentStatus; productId?: string; warehouseCode?: string; search?: string; dateFrom?: string; dateTo?: string; limit?: number }) =>
    get<LedgerEntry[]>('/ledger', { ...f }),
};

export const dashboard = {
  kpis: (f?: { warehouseId?: string; category?: string }) => get<DashboardKPIs & { inStockProducts: number }>('/dashboard/kpis', { ...f }),
  lowStock: (f?: { warehouseId?: string; category?: string }) =>
    get<{ productId: string; sku: string; name: string; category: string; totalStock: number; stockStatus: Product['stockStatus']; reorderThreshold: number | null; suggestedOrderQty: number }[]>(
      '/dashboard/low-stock',
      { ...f },
    ),
  operations: (f?: { warehouseId?: string }) =>
    get<{ byTypeAndStatus: { type: string; status: DocumentStatus; count: number }[]; adjustments: number }>('/dashboard/operations', { ...f }),
};

export const reorder = {
  /** Draft a receipt for every product at/below its reorder threshold (manager only). */
  draftReceipt: (b: { warehouseId: string; supplier?: string; productIds?: string[] }) =>
    post<{
      receipt: { id: string; reference: string; status: DocumentStatus; lines: { productId: string; sku: string; name: string; quantity: number }[] } | null;
      skipped: { productId: string; sku: string; reason: string }[];
    }>('/reorder/draft-receipt', b),
};

export const auth = {
  login: (email: string, password: string) => authRequest<Session>('/auth/login', { email, password }),
  signup: (name: string, email: string, password: string, role: string) => authRequest<Session>('/auth/signup', { name, email, password, role }),
  logout: () => authRequest<void>('/auth/logout'),
  forgotPassword: (email: string) => authRequest<{ message: string; devOtp?: string }>('/auth/forgot-password', { email }),
  resetPassword: (email: string, otp: string, newPassword: string) => authRequest<{ message: string }>('/auth/reset-password', { email, otp, newPassword }),
};

export const users = {
  me: () => get<User>('/users/me'),
  updateMe: (b: { name?: string; email?: string }) => patch<User>('/users/me', b),
  changePassword: (currentPassword: string, newPassword: string) => post<void>('/users/me/password', { currentPassword, newPassword }),
  list: () => get<User[]>('/users'),
};
