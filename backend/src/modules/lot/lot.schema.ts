import { z } from 'zod';

export const LotStatus = ['PENDING_QC', 'APPROVED', 'REJECTED', 'CONSUMED'] as const;
export type LotStatusType = typeof LotStatus[number];

export const CreateLotSchema = z.object({
  lotNumber: z.string().min(1, 'Nomor lot wajib diisi'),
  materialId: z.string().uuid('Material ID tidak valid'),
  supplierId: z.string().uuid('Supplier ID tidak valid'),
  quantity: z.number().positive('Quantity harus lebih dari 0'),
  unit: z.string().min(1, 'Satuan wajib diisi'),
  expiryDate: z.string().datetime().optional().or(z.literal('')),
});

export const UpdateLotStatusSchema = z.object({
  status: z.enum(LotStatus, {
    errorMap: () => ({ message: `Status harus salah satu dari: ${LotStatus.join(', ')}` }),
  }),
});

export type CreateLotInput = z.infer<typeof CreateLotSchema>;
export type UpdateLotStatusInput = z.infer<typeof UpdateLotStatusSchema>;
