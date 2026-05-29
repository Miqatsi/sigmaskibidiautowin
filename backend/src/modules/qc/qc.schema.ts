import { z } from 'zod';

export const QCType = ['INCOMING', 'IN_PROCESS', 'FINAL'] as const;
export const QCResult = ['PASS', 'FAIL', 'CONDITIONAL'] as const;

export type QCTypeValue = typeof QCType[number];
export type QCResultValue = typeof QCResult[number];

export const CreateQCSchema = z.object({
  type: z.enum(QCType, { errorMap: () => ({ message: 'Type harus: INCOMING, IN_PROCESS, atau FINAL' }) }),
  result: z.enum(QCResult, { errorMap: () => ({ message: 'Result harus: PASS, FAIL, atau CONDITIONAL' }) }),
  rawMaterialLotId: z.string().uuid('Lot ID tidak valid').optional(),
  batchId: z.string().uuid('Batch ID tidak valid').optional(),
  notes: z.string().optional(),
  metrics: z.record(z.unknown()).optional(), // Flexible JSON for measurement data
});

export const UpdateQCSchema = z.object({
  result: z.enum(QCResult).optional(),
  notes: z.string().optional(),
  metrics: z.record(z.unknown()).optional(),
});

export type CreateQCInput = z.infer<typeof CreateQCSchema>;
export type UpdateQCInput = z.infer<typeof UpdateQCSchema>;
