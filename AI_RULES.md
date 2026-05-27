# AI Rules — Sima Arome (Enterprise-Ready AI Manufacturing App)

## Tech Stack

- **Frontend:** Next.js (App Router) + Tailwind CSS
- **Backend:** Node.js (Express)
- **Language:** TypeScript (strict mode)

## Security (Enterprise-Ready)

- JANGAN PERNAH hardcode API keys, secrets, atau credentials di dalam kode.
- Selalu gunakan `process.env.VARIABLE_NAME` untuk mengakses konfigurasi sensitif.
- Simpan semua secrets di file `.env` yang sudah di-ignore oleh Git.
- Validasi semua input dari user di sisi backend sebelum diproses.

## TypeScript Interfaces

Selalu definisikan TypeScript interfaces untuk setiap model database:

```typescript
interface Lot {
  id: string;
  // ... field lainnya
  created_at: Date;
  updated_at: Date;
  updated_by: string;
}

interface User {
  id: string;
  // ... field lainnya
  created_at: Date;
  updated_at: Date;
  updated_by: string;
}

interface QCLog {
  id: string;
  // ... field lainnya
  created_at: Date;
  updated_at: Date;
  updated_by: string;
}
```

## Audit Trails

Setiap operasi database WAJIB mengimplementasikan audit trail:

- `created_at` — timestamp saat record dibuat
- `updated_at` — timestamp saat record terakhir diubah
- `updated_by` — user ID yang melakukan perubahan

Tidak boleh ada operasi CREATE atau UPDATE tanpa mengisi field audit trail.

## UI/UX Design

- Gunakan **high-contrast colors** agar mudah dibaca di lingkungan pabrik.
- Font size minimal `text-base` (16px), gunakan `text-lg` atau `text-xl` untuk elemen penting.
- Tombol harus besar dan mudah di-tap (`min-h-12`, `px-6`).
- Gunakan Tailwind CSS utility classes secara konsisten.
- Desain harus responsif dan mobile-friendly untuk operator yang menggunakan tablet.

## Code Quality

- **Modular:** Maksimal 50 baris per fungsi. Jika lebih, pecah menjadi fungsi-fungsi kecil.
- **Error Handling:** Selalu gunakan `try-catch` di setiap endpoint backend API.
- **Error Messages:** Berikan pesan error yang jelas dan informatif ke client.

```typescript
// Contoh pattern backend API
export async function handler(req: Request, res: Response) {
  try {
    // logic here (max 50 lines)
    const result = await someOperation();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[EndpointName] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server. Silakan coba lagi.',
    });
  }
}
```

## Konvensi Umum

- Gunakan `camelCase` untuk variabel dan fungsi.
- Gunakan `PascalCase` untuk interfaces, types, dan komponen React.
- Gunakan `UPPER_SNAKE_CASE` untuk environment variables.
- Setiap file harus memiliki satu tanggung jawab utama (Single Responsibility).
- Tambahkan komentar untuk logic yang kompleks.
