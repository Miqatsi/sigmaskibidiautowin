import { z } from 'zod';

export const TransactionType = ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'CONSUME', 'SHIP'] as const;

export const CreateTransactionSchema = z.object({
  type: z.enum(TransactionType, { error: `Type harus: ${TransactionType.join(', ')}` }),
  storageLocationId: z.string().uuid('Storage location ID tidak valid'),
  batchId: z.string().uuid('Batch ID tidak valid').optional(),
  quantity: z.number().refine((n) => n !== 0, { message: 'Quantity tidak boleh 0' }), // Positive = IN, Negative = OUT
  unit: z.string().min(1, 'Satuan wajib diisi'),
  reference: z.string().optional(), // dispatch number, adjustment reason, etc.
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
