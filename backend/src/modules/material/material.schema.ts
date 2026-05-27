import { z } from 'zod';

export const CreateMaterialSchema = z.object({
  name: z.string().min(1, 'Nama material wajib diisi'),
  code: z.string().min(1, 'Kode material wajib diisi').max(20),
  unit: z.string().min(1, 'Satuan wajib diisi'), // kg, liter, pcs
});

export const UpdateMaterialSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
});

export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;
