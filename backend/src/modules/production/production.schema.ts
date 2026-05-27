import { z } from 'zod';

export const OrderStatus = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export const BatchStatus = ['IN_PROGRESS', 'COMPLETED', 'FAILED'] as const;

export const CreateOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Nomor order wajib diisi'),
  productId: z.string().uuid('Product ID tidak valid'),
  quantity: z.number().positive('Quantity harus lebih dari 0'),
  unit: z.string().min(1, 'Satuan wajib diisi'),
  plannedDate: z.string().datetime('Format tanggal tidak valid'),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(OrderStatus, { errorMap: () => ({ message: `Status harus: ${OrderStatus.join(', ')}` }) }),
});

export const CreateBatchSchema = z.object({
  lotNumber: z.string().min(1, 'Nomor lot batch wajib diisi'),
  orderId: z.string().uuid('Order ID tidak valid'),
  quantity: z.number().positive('Quantity harus lebih dari 0'),
  unit: z.string().min(1, 'Satuan wajib diisi'),
  rawMaterialLotIds: z.array(z.object({
    lotId: z.string().uuid(),
    quantityUsed: z.number().positive(),
    unit: z.string().min(1),
  })).min(1, 'Minimal 1 raw material lot harus digunakan'),
});

export const UpdateBatchStatusSchema = z.object({
  status: z.enum(BatchStatus, { errorMap: () => ({ message: `Status harus: ${BatchStatus.join(', ')}` }) }),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type CreateBatchInput = z.infer<typeof CreateBatchSchema>;
