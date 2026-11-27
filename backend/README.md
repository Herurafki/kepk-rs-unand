# KEPK — Sistem Izin Pengambilan Data Penelitian

Backend sistem informasi untuk mengelola proses pengajuan izin pengambilan data awal penelitian pada **Komisi Etik Penelitian Kesehatan (KEPK)**.

## Deskripsi Proyek

Sistem KEPK menggantikan proses pengajuan manual menjadi alur digital yang terstruktur, terdokumentasi, dan dapat dilacak. Sistem melibatkan empat aktor utama: **Peneliti**, **Diklat**, **Sekretaris KEPK**, dan **Ketua Reviewer (KETUA)** beserta **Reviewer**.

Fitur utama:
- Registrasi dan autentikasi berbasis JWT (access token + refresh token)
- Pengajuan izin penelitian dengan status tracking lengkap
- Upload dokumen persyaratan (PDF/JPEG/PNG)
- Verifikasi administrasi oleh Diklat
- Proses kajian etik oleh Reviewer dengan tiga jenis telaah (EXEMPTED, EXPEDITED, FULL_BOARD)
- Penerbitan surat izin
- Histori perubahan status yang tidak dapat dimodifikasi

---

## Persyaratan

| Komponen | Versi Minimum |
|----------|---------------|
| Node.js  | 18            |
| PostgreSQL | 14          |
| npm      | 8             |

---

## Instalasi

```bash
# 1. Clone repository
git clone <url-repo>
cd kepk

# 2. Install dependencies
npm install

# 3. Salin file environment dan isi nilainya
cp .env.example .env
# Edit .env sesuai konfigurasi lokal

# 4. Buat database dan jalankan migrasi
node src/config/migrate.js

# 5. Jalankan server
npm run dev
```

---

## Environment Variables

Buat file `.env` di root project. Gunakan `.env.example` sebagai template.

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | `5000` | Port HTTP server |
| `DB_HOST` | `localhost` | Host database PostgreSQL |
| `DB_PORT` | `5432` | Port database PostgreSQL |
| `DB_NAME` | `kepk_db` | Nama database |
| `DB_USER` | `postgres` | Username database |
| `DB_PASSWORD` | *(kosong)* | Password database |
| `JWT_SECRET` | *(wajib diisi)* | Secret key untuk signing JWT — gunakan nilai acak yang panjang |
| `JWT_EXPIRES_IN` | `1d` | Masa berlaku access token (e.g., `1h`, `1d`) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Masa berlaku refresh token dalam hari |
| `UPLOAD_DIR` | `uploads` | Direktori penyimpanan file upload |
| `MAX_FILE_SIZE` | `10485760` | Ukuran maksimum file upload dalam bytes (default 10 MB) |
| `NODE_ENV` | `development` | Environment runtime (`development` / `production`) |

> **Penting:** Jangan pernah commit file `.env` ke repository. File ini sudah terdaftar di `.gitignore`.

---

## Setup PostgreSQL

```sql
-- Buat database
CREATE DATABASE kepk_db;

-- Verifikasi (opsional)
\c kepk_db
\dt
```

Jalankan migrasi schema dan seed data roles:

```bash
node src/config/migrate.js
```

Script ini akan membuat semua tabel dan mengisi tabel `roles` dengan nilai default:
`PENELITI`, `DIKLIT`, `SEKRETARIAT`, `KETUA`, `REVIEWER`, `SUPERADMIN`.

---

## Menjalankan Server

```bash
# Development (dengan auto-reload via nodemon)
npm run dev

# Production
npm start
```

Server berjalan pada `http://localhost:5000` (sesuai nilai `PORT` di `.env`).

Health check: `GET http://localhost:5000/api/health`

---

## Autentikasi

Sistem menggunakan **JWT Bearer Token**.

**Flow:**
1. `POST /api/auth/login` → mendapatkan `access_token` + `refresh_token`
2. Sertakan token pada setiap request yang memerlukan autentikasi:
   ```
   Authorization: Bearer <access_token>
   ```
3. Saat access token kadaluarsa, gunakan `POST /api/auth/refresh` dengan `refresh_token`
4. Logout: `POST /api/auth/logout` untuk mencabut refresh token

**JWT Payload:**
```json
{
  "sub": "user-uuid",
  "name": "Nama User",
  "email": "user@example.com",
  "roles": ["PENELITI"]
}
```

---

## Role & Otorisasi

| Role | Kemampuan Utama |
|------|-----------------|
| `PENELITI` | Registrasi mandiri; buat, edit, submit, revisi pengajuan milik sendiri; upload dokumen; lihat status & surat izin |
| `DIKLIT` | Verifikasi administrasi; buka, setujui, minta revisi, atau tolak pengajuan; upload surat izin |
| `SEKRETARIAT` | Teruskan pengajuan ke kajian etik; minta revisi; buat akun REVIEWER |
| `KETUA` | Tugaskan reviewer; set jenis telaah; keputusan akhir (setuju/revisi/tolak) |
| `REVIEWER` | Lihat pengajuan yang ditugaskan; terima/tolak penugasan; submit review dan komentar |
| `SUPERADMIN` | Kelola semua user; assign/hapus role; lihat audit log |

Otorisasi selalu diverifikasi di backend. Frontend tidak boleh dijadikan mekanisme keamanan.

---

## Alur Pengajuan (Application Workflow)

```
DRAFT
  └── SUBMITTED                    ← Peneliti submit

SUBMITTED
  └── ADMIN_REVIEW                 ← Diklat buka pengajuan

ADMIN_REVIEW
  ├── REVISION_REQUIRED            ← Diklat minta revisi
  └── ADMIN_APPROVED               ← Diklat setujui administrasi

REVISION_REQUIRED
  └── SUBMITTED                    ← Peneliti kirim ulang

ADMIN_APPROVED
  ├── PERMIT_ISSUED                ← Diklat upload surat (jalur tanpa etik)
  └── SEKRETARIS_REVIEW            ← Sekretaris KEPK teruskan (jalur etik)

SEKRETARIS_REVIEW
  ├── REVISION_REQUIRED            ← Sekretaris minta revisi
  └── WAITING_REVIEWER             ← Sekretaris forward ke reviewer

WAITING_REVIEWER
  └── UNDER_REVIEW                 ← Reviewer menerima penugasan (kondisi terpenuhi)
  atau
  ├── APPROVED                     ← Chief KEPK (EXEMPTED langsung)
  └── REJECTED                     ← Chief KEPK (EXEMPTED langsung)

UNDER_REVIEW
  └── REVIEW_COMPLETED             ← Kondisi review terpenuhi (otomatis)

REVIEW_COMPLETED
  ├── APPROVED                     ← Chief KEPK setujui
  ├── REVISION_REQUIRED            ← Chief KEPK minta revisi
  └── REJECTED                     ← Chief KEPK tolak

APPROVED
  └── PERMIT_ISSUED                ← Diklat upload surat izin etik
```

### Jenis Telaah (Review Type)

| Jenis | Keterangan |
|-------|------------|
| `EXEMPTED` | Bebas kajian etik; Chief KEPK langsung memutuskan dari `WAITING_REVIEWER` |
| `EXPEDITED` | 1–2 reviewer; selesai saat semua reviewer ACCEPTED telah submit review |
| `FULL_BOARD` | Banyak reviewer; semua harus accept dulu; selesai saat ≥ 75% telah submit review |

---

## Upload Dokumen

- **Endpoint:** `POST /api/applications/:id/documents` (multipart/form-data, field: `file`)
- **Tipe diizinkan:** PDF, JPEG, PNG
- **Ukuran maksimum:** 10 MB (configurable via `MAX_FILE_SIZE`)
- **Nama file disimpan:** UUID-generated (tidak menggunakan nama asli dari user)
- **Penyimpanan:** `uploads/applications/<application-id>/<uuid>.<ext>`

Metadata file (nama asli, nama tersimpan, path, mime type, ukuran) disimpan di database tabel `documents`.

---

## Struktur API Endpoints

### Authentication

| Method | Path | Auth | Role | Deskripsi |
|--------|------|------|------|-----------|
| POST | `/api/auth/register` | — | — | Daftar akun PENELITI |
| POST | `/api/auth/login` | — | — | Login, mendapat access + refresh token |
| POST | `/api/auth/logout` | — | — | Logout, cabut refresh token |
| POST | `/api/auth/refresh` | — | — | Tukar refresh token → access token baru |
| GET | `/api/auth/me` | ✓ | Semua | Profil user yang sedang login |

### Applications

| Method | Path | Auth | Role | Deskripsi |
|--------|------|------|------|-----------|
| GET | `/api/applications` | ✓ | Semua | List pengajuan (filtered by role) |
| POST | `/api/applications` | ✓ | PENELITI | Buat draft pengajuan baru |
| GET | `/api/applications/:id` | ✓ | Semua | Detail pengajuan |
| PUT | `/api/applications/:id` | ✓ | PENELITI | Update draft pengajuan |
| DELETE | `/api/applications/:id` | ✓ | PENELITI | Hapus draft pengajuan |
| POST | `/api/applications/:id/submit` | ✓ | PENELITI | Submit pengajuan (DRAFT → SUBMITTED) |
| POST | `/api/applications/:id/revise` | ✓ | PENELITI | Kirim ulang setelah revisi |

### Documents

| Method | Path | Auth | Role | Deskripsi |
|--------|------|------|------|-----------|
| POST | `/api/applications/:id/documents` | ✓ | PENELITI | Upload dokumen (multipart) |
| GET | `/api/applications/:id/documents` | ✓ | Semua | List dokumen pengajuan |
| GET | `/api/documents/:id` | ✓ | Semua | Metadata dokumen |
| DELETE | `/api/documents/:id` | ✓ | PENELITI | Hapus dokumen (draft only) |
| GET | `/api/documents/:id/download` | ✓ | Semua | Download file dokumen |

### Diklat Verification

| Method | Path | Auth | Role | Deskripsi |
|--------|------|------|------|-----------|
| GET | `/api/admin/applications` | ✓ | DIKLIT | List antrian verifikasi |
| GET | `/api/admin/applications/:id` | ✓ | DIKLIT | Detail pengajuan |
| POST | `/api/admin/applications/:id/open` | ✓ | DIKLIT | Buka pengajuan (SUBMITTED → ADMIN_REVIEW) |
| POST | `/api/admin/applications/:id/revision` | ✓ | DIKLIT | Minta revisi |
| POST | `/api/admin/applications/:id/reject` | ✓ | DIKLIT | Tolak pengajuan |
| POST | `/api/admin/applications/:id/approve-without-ethics` | ✓ | DIKLIT | Setujui tanpa kajian etik |
| POST | `/api/admin/applications/:id/approve-with-ethics` | ✓ | DIKLIT | Setujui dengan kajian etik |

### Sekretaris KEPK

| Method | Path | Auth | Role | Deskripsi |
|--------|------|------|------|-----------|
| GET | `/api/sekretaris/applications` | ✓ | SEKRETARIAT | List pengajuan ADMIN_APPROVED |
| POST | `/api/sekretaris/applications/:id/forward` | ✓ | SEKRETARIAT | Teruskan ke kajian etik |
| POST | `/api/sekretaris/applications/:id/revision` | ✓ | SEKRETARIAT | Minta revisi dari SEKRETARIS_REVIEW |

### Reviewer Assignments

| Method | Path | Auth | Role | Deskripsi |
|--------|------|------|------|-----------|
| GET | `/api/review-assignments/reviewers` | ✓ | KETUA | List reviewer tersedia |
| GET | `/api/review-assignments` | ✓ | REVIEWER, KETUA | List penugasan |
| POST | `/api/applications/:id/assign-reviewer` | ✓ | KETUA | Tugaskan reviewer |
| POST | `/api/review-assignments/:id/accept` | ✓ | REVIEWER | Terima penugasan |
| POST | `/api/review-assignments/:id/reject` | ✓ | REVIEWER | Tolak penugasan |

### Reviews

| Method | Path | Auth | Role | Deskripsi |
|--------|------|------|------|-----------|
| GET | `/api/reviews` | ✓ | REVIEWER, KETUA, DIKLIT | List review |
| GET | `/api/reviews/:id` | ✓ | REVIEWER, KETUA, DIKLIT | Detail review |
| POST | `/api/applications/:id/reviews` | ✓ | REVIEWER | Submit review |
| PUT | `/api/reviews/:id` | ✓ | REVIEWER | Update review |
| GET | `/api/reviews/:id/comments` | ✓ | REVIEWER, KETUA | Komentar review |
| POST | `/api/reviews/:id/comments` | ✓ | REVIEWER | Tambah komentar |

### Final Decision

| Method | Path | Auth | Role | Deskripsi |
|--------|------|------|------|-----------|
| POST | `/api/applications/:id/decision/approve` | ✓ | KETUA | Setujui pengajuan |
| POST | `/api/applications/:id/decision/revision` | ✓ | KETUA | Minta revisi (dari REVIEW_COMPLETED) |
| POST | `/api/applications/:id/decision/reject` | ✓ | KETUA | Tolak pengajuan |

### Letters

| Method | Path | Auth | Role | Deskripsi |
|--------|------|------|------|-----------|
| GET | `/api/applications/:id/letter` | ✓ | Semua (owner/staff) | Metadata surat izin |
| POST | `/api/applications/:id/letter` | ✓ | DIKLIT | Upload surat izin (multipart) |
| GET | `/api/letters/:id/download` | ✓ | Semua (owner/staff) | Download surat izin |

### Application History

| Method | Path | Auth | Role | Deskripsi |
|--------|------|------|------|-----------|
| GET | `/api/applications/:id/history` | ✓ | Semua | Riwayat status pengajuan |
| GET | `/api/applications/:id/revisions` | ✓ | Semua | Daftar revisi pengajuan |

---

## Testing dengan Postman

1. Import `docs/KEPK.postman_collection.json` ke Postman
2. Import `docs/KEPK.postman_environment.json` sebagai environment
3. Pastikan `base_url = http://localhost:5000`
4. Jalankan request **Login** sesuai role → token otomatis tersimpan ke variabel environment
5. Ikuti urutan folder sesuai workflow pengajuan

### Urutan Testing Workflow Lengkap

```
[1. Authentication] Register → Login (semua role)
[2. Applications] Create → Upload Document → Submit
[4. Diklat Verification] Open → Approve with/without Ethics
[5. Sekretaris KEPK] Forward to Review
[6. Reviewer Assignments] Assign → Accept
[7. Reviews] Submit Review
[8. Final Decision] Approve / Reject / Revision
[9. Letters] Issue Letter → Download
[10. Application History] Check History
```

### Test Script Otomatis

```bash
# Pastikan server berjalan, lalu:
node src/test-all.js
```

Menjalankan 29 test case otomatis mencakup autentikasi, CRUD pengajuan, validasi, otorisasi role, token refresh/revoke, dan validasi transisi status.

---

## Struktur Database

| Tabel | Deskripsi |
|-------|-----------|
| `roles` | Role yang tersedia dalam sistem |
| `users` | Data autentikasi pengguna (email, password hash) |
| `user_roles` | Relasi many-to-many users ↔ roles |
| `researchers` | Profil detail pengguna dengan role PENELITI |
| `refresh_tokens` | Refresh token aktif per user |
| `applications` | Pengajuan izin penelitian |
| `documents` | Metadata dokumen yang diupload |
| `review_assignments` | Penugasan reviewer ke pengajuan |
| `reviews` | Hasil penilaian reviewer |
| `review_comments` | Komentar tambahan pada review |
| `application_status_histories` | Riwayat perubahan status (immutable) |
| `revisions` | Permintaan revisi beserta catatan |
| `final_decisions` | Keputusan akhir oleh KETUA |
| `letters` | Metadata surat izin yang diterbitkan |
| `audit_logs` | Log aktivitas pengguna di sistem |

---

## Struktur Project

```
src/
├── config/         # Konfigurasi database dan environment
├── controllers/    # HTTP request/response handlers
├── middleware/     # Auth, role, upload, validation, error
├── models/         # Database queries (raw SQL)
├── routes/         # Definisi endpoint dan middleware chain
├── services/       # Business logic
├── validators/     # Validasi input request
└── utils/          # JWT helper, response formatter, file utils
```

---

## Deployment

```bash
# Set environment production
NODE_ENV=production

# Gunakan JWT_SECRET yang kuat (minimal 32 karakter random)
JWT_SECRET=<random-string-panjang>

# Pastikan credentials DB sudah benar
DB_HOST=<production-db-host>
DB_PASSWORD=<strong-password>

# Jalankan
npm start
```

**Catatan keamanan:**
- Jangan gunakan nilai default `JWT_SECRET` di production
- Gunakan HTTPS di production (reverse proxy seperti nginx)
- Set `CORS_ORIGIN` ke domain frontend yang diizinkan
- Stack trace tidak akan dikembalikan ke client saat `NODE_ENV=production`

---

## Tech Stack

| Komponen | Library |
|----------|---------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | PostgreSQL |
| DB Driver | `pg` (node-postgres) |
| Authentication | JWT (`jsonwebtoken`) |
| Password Hashing | `bcrypt` |
| File Upload | `multer` |
| Security Headers | `helmet` |
| CORS | `cors` |
| Dev Server | `nodemon` |
#   k e p k - r s - u n a n d  
 