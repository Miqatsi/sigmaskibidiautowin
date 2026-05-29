// ============================================================
// Sima Arome — Frontend Type Definitions
// ============================================================

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roleId: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  code: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  code: string;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface RawMaterialLot {
  id: string;
  lotNumber: string;
  materialId: string;
  supplierId: string;
  quantity: number;
  unit: string;
  receivedAt: string;
  expiryDate?: string;
  status: 'PENDING_QC' | 'APPROVED' | 'REJECTED' | 'CONSUMED';
  material?: RawMaterial;
  supplier?: Supplier;
  createdAt: string;
  updatedAt: string;
}

export interface QCLog {
  id: string;
  type: 'INCOMING' | 'IN_PROCESS' | 'FINAL';
  result: 'PASS' | 'FAIL' | 'CONDITIONAL';
  notes?: string;
  rawMaterialLotId?: string;
  batchId?: string;
  rawMaterialLot?: RawMaterialLot;
  batch?: ProductionBatch;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionOrder {
  id: string;
  orderNumber: string;
  productId: string;
  quantity: number;
  unit: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  plannedDate: string;
  product?: Product;
  batches?: ProductionBatch[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductionBatch {
  id: string;
  lotNumber: string;
  orderId: string;
  quantity: number;
  unit: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  order?: ProductionOrder;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'CONSUME' | 'SHIP';
  storageLocationId: string;
  batchId?: string;
  quantity: number;
  unit: string;
  reference?: string;
  storageLocation?: StorageLocation;
  batch?: ProductionBatch;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location?: string;
  storageLocations?: StorageLocation[];
  createdAt: string;
  updatedAt: string;
}

export interface StorageLocation {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
  warehouse?: Warehouse;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoginCredentials {
  login: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User & {
    // Backend may return role as string or object
    role: Role | string;
  };
}
