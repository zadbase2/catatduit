# 📋 Sistem & Arsitektur Data CatatDuit
# Pencatatan Keuangan Pribadi Berbasis AI & Offline-First Sync Engine

> **Versi**: 2.0 (Post-Audit, Perbaikan Arsitektur, & Evaluasi Sinkronisasi)  
> **Status**: Production Architecture & Engineering Specification  
> **Ruang Lingkup**: Core Engine, Database Schema, AI Orchestration, Sync Engine, API Contract, dan Post-Mortem Audit & Evaluasi

---

## 1. Visi & Prinsip Sistem

**CatatDuit** adalah sistem pencatatan keuangan pribadi dengan pendekatan **Natural Language Processing** dan arsitektur **Offline-First**. Pengguna mencatat transaksi melalui kalimat percakapan sehari-hari yang kemudian diekstrak oleh Google Gemini AI menjadi data terstruktur.

### Prinsip Utama Arsitektur Data:
1. **PostgreSQL sebagai Single Source of Truth**: Saat perangkat terhubung ke internet (online), database cloud PostgreSQL (Neon / Vercel Postgres) adalah satu-satunya sumber kebenaran data yang valid.
2. **Local Storage / IndexedDB sebagai Cache & Offline Buffer**: Penyimpanan lokal di perangkat klien bertindak sebagai cache pembacaan instan dan antrean transaksi offline, bukan sebagai database independen.
3. **True Offline-First Resilience**: Semua operasi (Create, Update, Delete) dapat dilakukan tanpa koneksi internet dan dijamin tersinkronisasi secara idempotent saat online kembali.
4. **Idempotency & Zero Duplication**: Setiap transaksi memiliki Client-Generated UUID sebelum dikirim ke jaringan, mencegah duplikasi data saat terjadi *network timeout*, *retry*, atau koneksi fluktuatif.
5. **Cross-Platform Data Consistency**: Klien Website dan aplikasi mobile Capacitor terhubung ke instance database PostgreSQL yang sama secara konsisten dan reaktif.

---

## 2. Tech Stack Arsitektur

| Layer | Teknologi | Peran & Justifikasi Teknis |
|---|---|---|
| **Runtime Environment** | Node.js (Vercel Serverless & Local Engine) | Menjalankan API endpoints, background handler, dan migrasi database. |
| **Database Cloud** | Vercel Postgres / Neon (PostgreSQL 15+) | Penyimpanan relasional persisten, kepatuhan ACID, indeks performa tinggi, SSL connection pooling. |
| **Database Adapter** | `pg` (Node-Postgres Pool) | Driver koneksi PostgreSQL dengan penanganan pooling koneksi serverless dan TLS/SSL. |
| **Local Storage / Cache** | Web Storage API (localStorage) / IndexedDB | Penyimpanan snapshot transaksi lokal dan penampung write-ahead log `pendingQueue`. |
| **AI Parsing Engine** | Google Gemini (Cascade: Flash-Lite → Flash) | Ekstraksi entitas nominal, tipe, dan kategori dari bahasa natural percakapan. |
| **Local Regex Fallback** | Deterministic Pattern Matcher | Parser cadangan lokal jika perangkat offline total atau kuota API habis. |
| **Mobile Runtime** | Capacitor Core & Android Platform | Runtime container untuk membungkus aset web menjadi aplikasi native Android mandiri. |
| **Sync Engine** | Bi-Directional Reconciliation Manager | Engine sinkronisasi dua arah (Push antrean lokal & Pull snapshot PostgreSQL). |

---

## 3. Diagram Arsitektur Data & Sinkronisasi

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT RUNTIME                                  │
│                 (Browser Website / Capacitor Mobile App)                    │
│                                                                             │
│  ┌──────────────────────────┐             ┌──────────────────────────────┐  │
│  │   Input Controller       │             │   Local State Cache          │  │
│  │   (Natural Lang / Form)  │────────────→│   (localStorage / IndexedDB) │  │
│  └─────────────┬────────────┘             └──────────────┬───────────────┘  │
│                │                                         │                  │
│                ▼                                         ▼                  │
│  ┌──────────────────────────┐             ┌──────────────────────────────┐  │
│  │   AI / Regex Parser      │             │   Pending Write-Ahead Queue  │  │
│  │   (Structured Extractor) │             │   (catatduit_pending_queue_v1)│  │
│  └──────────────────────────┘             └──────────────┬───────────────┘  │
│                                                          │                  │
│                                            Online Sync   │ (Auto Flush &    │
│                                            Reconcile     │  Pull Snapshot)  │
└──────────────────────────────────────────────────────────┼──────────────────┘
                                                           │
                                 HTTPS (CORS Enabled)      │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VERCEL SERVERLESS BACKEND (API)                        │
│                                                                             │
│  ┌─────────────────┐       ┌─────────────────┐       ┌───────────────────┐  │
│  │ /api/transactions│      │   /api/sync     │       │   /api/db-status  │  │
│  │ (CRUD Endpoints) │      │ (Batch Engine)  │       │  (Health Check)   │  │
│  └────────┬────────┘       └────────┬────────┘       └─────────┬─────────┘  │
│           │                         │                          │            │
│           └─────────────────────────┼──────────────────────────┘            │
│                                     ▼                                       │
│                       ┌───────────────────────────┐                         │
│                       │   Database Pool Manager   │                         │
│                       │   (SSL Connection Pool)   │                         │
│                       └─────────────┬─────────────┘                         │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEON POSTGRESQL (SINGLE SOURCE OF TRUTH)                 │
│                                                                             │
│   Tabel: `users`  |  `categories`  |  `transactions`  | `monthly_summaries` │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Skema Database

### 4.1 PostgreSQL Schema (Neon / Vercel Postgres)

```sql
-- 1. Tabel Users
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Categories
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    icon VARCHAR(20),
    color VARCHAR(20),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabel Transactions (Core Ledger)
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(100) PRIMARY KEY, -- Client-Generated UUID (Idempotency Key)
    user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    category_id VARCHAR(100) REFERENCES categories(id) ON DELETE SET NULL,
    category_name VARCHAR(100),
    category_icon VARCHAR(20),
    description VARCHAR(255),
    raw_input TEXT,
    ai_confidence DECIMAL(3, 2),
    transaction_date DATE NOT NULL,
    transaction_time VARCHAR(20),
    device_id VARCHAR(100),
    version INTEGER DEFAULT 1,
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing untuk efisiensi query analitik & penyaringan
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_sync ON transactions(sync_status) WHERE sync_status != 'synced';

-- 4. Tabel Monthly Summaries (Aggregation Cache)
CREATE TABLE IF NOT EXISTS monthly_summaries (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    total_income DECIMAL(15, 2) DEFAULT 0,
    total_expense DECIMAL(15, 2) DEFAULT 0,
    balance DECIMAL(15, 2) DEFAULT 0,
    category_breakdown JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, year_month)
);
```

### 4.2 Local Storage / Cache Keys (Client)

Penyimpanan lokal menggunakan namespace terisolasi untuk mencegah benturan versi data:
* `catatduit_transactions_v1`: Cache snapshot daftar transaksi.
* `catatduit_pending_queue_v1`: Antrean write-ahead log untuk operasi offline (`CREATE`, `UPDATE`, `DELETE`).
* `catatduit_categories_v1`: Cache master kategori.
* `catatduit_settings_v1`: Pengaturan preferensi pengguna dan konfigurasi API key.
* `catatduit_chat_history_v1`: Riwayat pesan interaksi natural language.

---

## 5. Orkes AI Parsing & Fallback Cascade

Sistem menerapkan **Adaptive Fallback Cascade** 3-tingkat untuk mengekstrak teks percakapan bahasa Indonesia menjadi format data terstruktur:

```
Input Pengguna: "makan siang padang 28rb"
       │
       ▼
[Tier 1: gemini-flash-lite-latest] (Timeout: 5 detik, latency minimal)
       │
       ├─ Gagal / 429 Rate Limit / 503 Overloaded
       ▼
[Tier 2: gemini-3.5-flash-lite / gemini-flash-latest]
       │
       ├─ Gagal / Timeout / Jaringan Terputus
       ▼
[Tier 3: Local Regex Fallback Engine] (Deterministic Pattern Matcher - 0ms network)
```

### Aturan Normalisasi Parsing Indonesia:
* **Nominal Multi-Satuan**: `5k` $\rightarrow$ 5.000, `50rb` $\rightarrow$ 50.000, `1.5jt` / `1,5 juta` $\rightarrow$ 1.500.000, `rp 30.000` $\rightarrow$ 30.000.
* **Deteksi Tipe Otomatis**: Kata kunci pemasukan (`gaji`, `transfer masuk`, `freelance`, `hadiah`, `bonus`, `dapet uang`) $\rightarrow$ `income`; kata kunci pembelian/pengeluaran $\rightarrow$ `expense`.
* **Struktur Output JSON Wajib**:
```json
{
  "type": "expense",
  "amount": 28000,
  "description": "Makan Siang Padang",
  "category_name": "Makanan & Minuman",
  "category_icon": "🍔",
  "confidence": 0.95
}
```

---

## 6. Arsitektur Sinkronisasi Data (Sync Engine)

### 6.1 Alur Kerja Operasi Online

1. **Client-Generated Unique ID**: Klien menghasilkan ID unik berbasis UUID v4 (`tx-{timestamp}-{uuid}`) sebelum transaksi diproses ke jaringan.
2. **Optimistic Local Cache**: Transaksi disimpan seketika di local cache dengan status `'pending'` agar eksekusi di sisi pengguna tidak terhambat (*non-blocking*).
3. **Write-Ahead Log**: Transaksi dicatat ke `pendingQueue`.
4. **Immediate API Dispatch**: Klien langsung mengirimkan request ke endpoint Vercel API (`POST /api/transactions`, `PUT /api/transactions/:id`, atau `DELETE /api/transactions/:id`).
5. **Konfirmasi Server**:
   - Jika HTTP 200/201 diterima: Status transaksi di local cache diubah menjadi `'synced'`, dan ID transaksi dihapus dari `pendingQueue`.
   - Jika terjadi gangguan jaringan atau server tidak merespons: Transaksi **tetap berstatus `'pending'`** di local cache dan tetap berada di `pendingQueue` untuk disinkronkan saat koneksi pulih.

### 6.2 Alur Kerja Operasi Offline

1. Klien mendeteksi status offline (`navigator.onLine === false` atau kegagalan koneksi).
2. Sistem **tidak melakukan pemanggilan API secara paksa**.
3. Operasi dicatat secara terstruktur ke antrean lokal:
   - `CREATE`: `{ action: 'CREATE', id: txId, data: txData }`
   - `UPDATE`: `{ action: 'UPDATE', id: txId, data: updatedFields }`
   - `DELETE`: `{ action: 'DELETE', id: txId, data: { id: txId } }`
4. Antrean lokal digabungkan secara cerdas: jika sebuah item dibuat saat offline lalu diedit sebelum terkirim, antrean digabungkan menjadi satu operasi `CREATE` dengan data terbaru. Jika dibuat lalu dihapus sebelum terkirim, item dihapus dari antrean tanpa perlu dikirim ke server.

### 6.3 Siklus Sinkronisasi Dua Arah (Bi-Directional Reconciliation)

Ketika perangkat kembali terhubung ke internet, aplikasi secara otomatis menjalankan siklus sinkronisasi dua arah:

#### Tahap 1: PUSH (Flush Antrean Pending)
* Seluruh item dalam `pendingQueue` dikirim sekaligus ke endpoint batch `POST /api/sync`.
* Server memproses antrean secara idempotent di PostgreSQL dan mengembalikan response:
  ```json
  {
    "success": true,
    "total": 10,
    "synced": 8,
    "syncedIds": ["tx-1", "tx-2", "..."],
    "errors": [{ "id": "tx-3", "error": "Validation failed" }]
  }
  ```
* **Partial Queue Resolution**: Klien **hanya menghapus ID yang terdaftar dalam `syncedIds`** dari antrean lokal. Transaksi yang gagal **tetap dipertahankan di antrean pending** untuk dievaluasi pada siklus berikutnya.

#### Tahap 2: PULL (PostgreSQL sebagai Sumber Kebenaran)
* Klien memanggil `GET /api/transactions?limit=500` untuk mengambil snapshot terbaru dari PostgreSQL.
* Klien melakukan rekonsiliasi data:
  1. Semua transaksi yang berasal dari server disimpan ke cache dengan status `'synced'`.
  2. Transaksi lokal yang masih berstatus `'pending'` di antrean tetap dipertahankan.
  3. Transaksi lokal yang berstatus `'synced'` tetapi **sudah tidak ditemukan di server** (misal telah dihapus dari Website atau perangkat lain) **otomatis dibersihkan dari cache lokal**.
* Local cache diperbarui dan seluruh modul data menyajikan snapshot akurat dari PostgreSQL.

### 6.4 Pemicu Otomatisasi Sinkronisasi (Auto-Trigger Triggers)
Sinkronisasi dijalankan secara otomatis tanpa intervensi manual pada peristiwa:
* **App Startup**: Begitu aplikasi atau halaman web dimuat pertama kali.
* **Network Online Event**: Saat koneksi internet kembali aktif (`window.addEventListener('online')`).
* **Window / Tab Focus**: Saat pengguna kembali membuka tab atau aplikasi dari latar belakang (`window.addEventListener('focus')` dan `document.addEventListener('visibilitychange')`).
* **Post-Mutation**: Sesaat setelah operasi Create, Update, atau Delete selesai diproses.

---

## 7. Kontrak REST API

Semua endpoint mendukung CORS penuh (`Access-Control-Allow-Origin: *`) dan mengembalikan response terstandarisasi JSON.

| Method | Endpoint | Fungsi | Payload / Query | Response Sukses |
|---|---|---|---|---|
| **GET** | `/api/db-status` | Health check koneksi database | - | `{ success: true, connected: true, isCloudDb: true, engine: "PostgreSQL..." }` |
| **GET** | `/api/transactions` | Mengambil daftar transaksi terverifikasi | `limit`, `offset`, `type`, `month`, `search` | `{ success: true, transactions: [...], total: N }` |
| **POST** | `/api/transactions` | Menambah transaksi baru (Idempotent) | JSON objek transaksi lengkap | `{ success: true, transaction: { id, amount, ... } }` (HTTP 201) |
| **PUT** | `/api/transactions/:id` | Memperbarui data transaksi | JSON field yang diubah | `{ success: true, transaction: { ... } }` (HTTP 200) |
| **DELETE** | `/api/transactions/:id` | Menghapus transaksi (Idempotent) | - | `{ success: true, id, message: "..." }` (HTTP 200) |
| **POST** | `/api/sync` | Batch ingestion antrean pending | `{ items: [{ action, id, data }] }` | `{ success: true, total: N, synced: N, syncedIds: [...], errors: [...] }` |
| **GET** | `/api/categories` | Mengambil master kategori | - | `{ success: true, categories: [...] }` |
| **POST** | `/api/categories` | Menambah kategori custom | `{ name, type, icon, color }` | `{ success: true, category: { ... } }` (HTTP 201) |
| **DELETE**| `/api/categories/:id` | Menghapus kategori & auto-reassign ke "Lainnya" | - | `{ success: true, reassignedCount: N }` |
| **GET** | `/api/summary` | Agregasi keuangan bulanan | `month=YYYY-MM` | `{ success: true, summary: { income, expense, balance, categoryBreakdown } }` |
| **POST** | `/api/parse` | Ekstraksi AI teks percakapan | `{ text, apiKey? }` | `{ success: true, parsed_by: "...", data: { ... } }` |
| **POST** | `/api/test-gemini`| Tes latensi & konektivitas model AI | `{ apiKey? }` | `{ success: true, activeModel: "...", latencyMs: N }` |

---

## 8. Konfigurasi Klien Mobile (Capacitor)

### 8.1 Strategi Offline-First Bundling
Pada `capacitor.config.json`:
* Pengaturan remote `"server": { "url": "..." }` **dihapus secara permanen**.
* Properti `"webDir": "www"` digunakan sebagai penyedia aset utama.
* **Dampak**: Aplikasi dapat dibuka seketika dalam kondisi *airplane mode* (tanpa koneksi internet) langsung dari memori internal perangkat tanpa mengalami error WebView (`net::ERR_INTERNET_DISCONNECTED`).

### 8.2 Dynamic API Base URL Resolver
Klien membedakan target URL API secara otomatis melalui fungsi:
```javascript
function getApiBaseUrl() {
  const isCapacitorNative = !!(
    (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
    (window.Capacitor && window.Capacitor.platform && window.Capacitor.platform !== 'web') ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:' ||
    (window.location.hostname === 'localhost' && window.location.port === '')
  );

  if (isCapacitorNative) {
    // Arahkan ke Production Vercel API untuk aplikasi mobile native
    return 'https://catatduit-seven.vercel.app';
  }

  // Untuk Web browser: gunakan relative path
  return '';
}
```

---

## 9. Evaluasi Komprehensif Masalah, Analisis Bug, & Post-Mortem

### 9.1 Kesimpulan Eksekutif Mengenai Bug
Bug utama yang dialami sistem adalah **inkonsistensi data antar-klien (Website vs Capacitor Android)**, di mana:
* Perubahan transaksi yang dilakukan di Website tidak tercermin di aplikasi Android.
* Sebaliknya, perubahan transaksi di aplikasi Android tidak terlihat di Website.
* Kedua platform beroperasi seolah-olah memiliki database terpisah, padahal seharusnya menggunakan PostgreSQL yang sama.

**Kesimpulan Akar Masalah:**  
Masalah ini **bukan disebabkan oleh kegagalan jaringan fisik**, melainkan oleh **enam kelemahan arsitektur data (*Architectural Flaws*)**:
1. **Ketiadaan Auto-Pull saat Startup/Focus**: Klien tidak pernah meminta snapshot terbaru dari PostgreSQL saat aplikasi dibuka atau saat pengguna kembali ke tab/aplikasi. Data hanya dibaca dari local storage perangkat masing-masing.
2. **Storage Sandboxing Tanpa Jembatan Reaktif**: `localStorage` peramban web dan `localStorage` WebView Android berada di sandbox terpisah. Tanpa auto-pull, kedua platform terperangkap dalam snapshot lokal masing-masing.
3. **Asimetri Operasi Offline**: Operasi `UPDATE` dan `DELETE` saat offline tidak dicatat ke `pendingQueue`, sehingga perubahan saat offline hilang permanen.
4. **Resurrection Bug (Zombie Records)**: Algoritma penggabungan data lama mempertahankan seluruh transaksi lokal. Transaksi yang telah dihapus di server dibangkitkan kembali (*resurrected*) oleh klien lain yang masih menyimpannya di cache lokal.
5. **Capacitor Mobile API Routing Dilemma**: Klien native Capacitor gagal mengeksekusi path relatif `/api` tanpa URL base eksplisit.
6. **False-Positive Database Status**: Backend melaporkan status terhubung meskipun koneksi PostgreSQL mati dan sistem beralih ke in-memory sementara yang lenyap saat Vercel cold restart.

---

### 9.2 Detail Evaluasi 13 Poin Audit Sistem

Audit teknis menyeluruh mengidentifikasi 13 temuan kritis yang telah dianalisis dan diperbaiki:

| No | Poin Audit | Kondisi Awal (Bermasalah) | Solusi & Evaluasi Teknis |
|:--:|---|---|---|
| **1** | **Lifecycle Hydration** | `store.init()` hanya memanggil `loadFromStorage()`. Tidak ada sinkronisasi saat aplikasi pertama kali dimuat. | Menambahkan pemanggilan `pullFromCloud()` otomatis di akhir inisialisasi store. |
| **2** | **Multi-Device Sync** | Local storage bertindak sebagai sumber data utama di masing-masing perangkat. | Menetapkan PostgreSQL sebagai Single Source of Truth mutlak; local storage murni sebagai cache. |
| **3** | **Offline Mutation Scope** | Hanya `CREATE` yang masuk antrean pending; `UPDATE` dan `DELETE` diabaikan saat offline. | Struktur `pendingQueue` diperluas mencakup aksi `CREATE`, `UPDATE`, dan `DELETE`. |
| **4** | **Reconciliation & Deletion** | Logika merge menggabungkan array lokal dan remote tanpa mendeteksi data yang dihapus di server. | Algoritma `pullFromCloud` mendeteksi dan menghapus record lokal bersatus `'synced'` yang tidak lagi ada di server. |
| **5** | **Idempotensi & Duplikasi** | Retry request menghasilkan record duplikat jika network timeout terjadi setelah server menulis data. | Client-Generated UUID (`tx-{timestamp}-{uuid}`) dipadukan dengan klausa SQL `INSERT ... ON CONFLICT (id) DO UPDATE`. |
| **6** | **Offline Mobile Bundling** | `capacitor.config.json` menggunakan `server.url` remote; crash saat offline. | Menghapus `server.url`, membundel aset web ke `www/` dan Android assets untuk load instan 100% offline. |
| **7** | **Mobile API Routing** | Path relatif `/api` gagal di lingkungan native Android (`capacitor://localhost`). | Helper `getApiBaseUrl()` secara dinamis mengarahkan panggilan native ke `https://catatduit-seven.vercel.app`. |
| **8** | **Partial Queue Resolution** | Antrean pending dihapus secara all-or-nothing (`this.pendingQueue = []`), menghilangkan item yang gagal kirim. | Server mengembalikan `syncedIds`; klien hanya menghapus transaksi yang sukses diakui oleh database. |
| **9** | **Server Payload Validation** | Handler transaksi menerima payload tanpa validasi tipe, memicu error query SQL. | Validasi ketat diterapkan di `api-handlers.js` untuk nominal, tanggal, dan format aksi. |
| **10** | **Idempotent DELETE Endpoint**| Menghapus ID yang sudah tidak ada berpotensi memicu error atau kegagalan antrean. | Query `DELETE` dibuat idempotent (`DELETE FROM transactions WHERE id = $1`) yang selalu aman di-retry. |
| **11** | **Health Check Integrity** | Endpoint `/api/db-status` melaporkan `connected: true` saat in-memory fallback aktif. | Nilai `isCloudDb: false` secara eksplisit dilaporkan jika pool PostgreSQL tidak terhubung. |
| **12** | **Pool & SSL Handshake** | Pool PostgreSQL di serverless berisiko mengalami SSL negotiation drop. | Konfigurasi `ssl: { rejectUnauthorized: false }` dan error listener diterapkan pada pool. |
| **13** | **Reactive Lifecycle Sync** | Pengguna yang kembali ke tab atau aplikasi melihat data basi tanpa pembaruan. | Listener `window.focus` dan `document.visibilitychange` memicu auto-sync saat tab/aplikasi aktif kembali. |

---

### 9.3 Matriks Evaluasi Arsitektur: Sebelum vs Sesudah Perbaikan

| Dimensi Arsitektur | Arsitektur Lama (Bermasalah) | Arsitektur Baru (Telah Diperbaiki & Terverifikasi) |
|---|---|---|
| **Otoritas Data Saat Online** | Terpecah di Local Storage masing-masing perangkat | Terpusat di PostgreSQL Neon (Single Source of Truth) |
| **Peran Local Storage** | Diperlakukan seperti database utama independen | Murni sebagai cache baca instan dan antrean offline sementara |
| **Pengambilan Data Awal** | Hanya membaca snapshot `localStorage` lama | Otomatis menjalankan `pullFromCloud()` dari PostgreSQL |
| **Reaktifitas Multi-Device** | Tidak ada sinkronisasi otomatis antar tab/perangkat | Auto-pull aktif saat event `focus`, `visibilitychange`, dan `online` |
| **Cakupan Antrean Offline** | Hanya operasi `CREATE` yang masuk antrean | Seluruh mutasi (`CREATE`, `UPDATE`, `DELETE`) dicatat ke `pendingQueue` |
| **Ketahanan Duplikasi (Retry)** | Risiko duplikasi data tinggi saat timeout | Idempotensi 100% via Client-Generated UUID + `ON CONFLICT` |
| **Penanganan Hapus Transaksi** | Terhapus lokal, remote terabaikan; memicu zombie record | Idempotent DELETE; rekonsiliasi dua arah membersihkan record terhapus |
| **Resolusi Antrean Batch** | All-or-nothing (antrean hangus atau tersangkut total) | Partial Queue: Hanya `syncedIds` yang dihapus dari antrean |
| **Akses Offline Mobile** | Bergantung pada web URL; error saat tanpa internet | Fully offline bundle di `www/`, load instan di mode pesawat |
| **Routing API Mobile** | Relative path gagal di native WebView | Dynamic API Base URL resolver (`https://catatduit-seven.vercel.app`) |
| **Integritas Status Database** | Melaporkan `connected: true` pada in-memory fallback | Diagnostik transparan: `isCloudDb: true/false` sesuai status riil |

---

### 9.4 Diagram Alur Komparatif: Kegagalan Lama vs Engine Baru

#### Alur Lama (Penyebab Inkonsistensi & Zombie Record):
```
[Client Website] ──DELETE (tx-1)──→ [PostgreSQL] (tx-1 terhapus di server)
                                        │
                                        ▼ (Tidak ada notifikasi/auto-pull)
[Client Android] ──Buka Aplikasi────→ Hanya baca localStorage (tx-1 masih ada)
                                        │
                                        ▼ (Saat sync manual dijalankan)
[Client Android] ──Merge Array──────→ tx-1 lokal di-upload ulang ke server!
                                        ▼
                            [PostgreSQL] (tx-1 HIDUP KEMBALI / ZOMBIE RECORD)
```

#### Alur Baru (Rekonsiliasi Sempurna & Sumber Kebenaran Tunggal):
```
[Client Website] ──DELETE (tx-1)──→ [PostgreSQL] (tx-1 terhapus di server)
                                        │
                                        ▼ (Pengguna membuka Android / window focus)
[Client Android] ──Auto-Pull────────→ GET /api/transactions
                                        │
                                        ├─ Server: [tx-2, tx-3] (tx-1 tidak ada)
                                        ├─ Android Cache: [tx-1 (synced), tx-2]
                                        ▼
[Reconciliation Engine] ──────────→ tx-1 dihapus dari cache Android secara otomatis!
                                        ▼
                            [Kedua Klien Konsisten 100%]
```

---

### 9.5 Rincian Hasil & Verifikasi 10 Skenario Pengujian Sistem

Seluruh 10 skenario pengujian komprehensif telah diuji secara empiris dan dinyatakan **100% LULUS (PASS)**:

| Skenario Uji | Deskripsi Skenario & Langkah Verifikasi | Ekspektasi Sistem | Hasil Verifikasi Empiris | Status |
|:---:|---|---|---|:---:|
| **TEST 1** | **Website → Android (Online)**<br>1. Buat transaksi baru di Website.<br>2. Verifikasi data tersimpan di PostgreSQL.<br>3. Buka Android & jalankan auto-pull.<br>4. Periksa transaksi di antarmuka Android. | Transaksi tersimpan di cloud dan otomatis muncul di aplikasi Android. | Transaksi terbuat di PostgreSQL dengan status `synced`. Klien Android menarik snapshot via `pullFromCloud` dan menampilkannya dengan presisi. | **PASS** |
| **TEST 2** | **Android → Website (Online)**<br>1. Ubah data transaksi dari Android.<br>2. Kirim update ke API Vercel.<br>3. Verifikasi perubahan di PostgreSQL.<br>4. Refresh Website dan verifikasi data. | Perubahan di Android langsung tercermin di Website. | API menerima `PUT /api/transactions/:id`, PostgreSQL terbarui, dan Website merefleksikan perubahan seketika setelah refresh. | **PASS** |
| **TEST 3** | **Offline CREATE**<br>1. Matikan internet Android.<br>2. Buat transaksi baru.<br>3. Verifikasi data di pending queue.<br>4. Nyalakan internet & sinkronkan. | Transaksi berstatus pending saat offline, lalu otomatis terunggah saat online. | Transaksi tercatat di `pendingQueue` dengan status `pending` tanpa memanggil API paksa. Saat online, batch sync mengunggah data ke PostgreSQL dan status berubah menjadi `synced`. | **PASS** |
| **TEST 4** | **Offline UPDATE**<br>1. Matikan internet Android.<br>2. Ubah data transaksi yang sudah ada.<br>3. Verifikasi pending queue.<br>4. Nyalakan internet & sinkronkan. | Perubahan tersimpan di pending queue dan terupdate ke PostgreSQL saat online. | Action `UPDATE` tercatat di antrean. Saat online, server memproses pembaruan, PostgreSQL terupdate, dan Website melihat nominal baru. | **PASS** |
| **TEST 5** | **Offline DELETE**<br>1. Matikan internet Android.<br>2. Hapus transaksi.<br>3. Verifikasi record masuk antrean DELETE.<br>4. Nyalakan internet & sinkronkan. | Record terhapus di cloud dan hilang permanen dari kedua klien. | Action `DELETE` tersimpan di antrean. Saat online, item terhapus di PostgreSQL dan otomatis terhapus dari snapshot Website (0 zombie record). | **PASS** |
| **TEST 6** | **Duplicate Protection (Retry)**<br>1. Kirim transaksi yang sama 2x dengan ID yang sama.<br>2. Simulasi network timeout / retry request.<br>3. Periksa jumlah baris di PostgreSQL. | Database hanya menyimpan 1 transaksi (zero duplication). | Client-Generated UUID + klausa SQL `ON CONFLICT (id) DO UPDATE` menjamin idempotensi penuh. Jumlah baris tetap tepat 1 record. | **PASS** |
| **TEST 7** | **Partial Sync (Mixed Batch)**<br>1. Siapkan 10 item pending (8 valid, 2 invalid).<br>2. Kirim batch ke `/api/sync`.<br>3. Verifikasi resolusi antrean klien. | 8 item sukses dihapus dari antrean, 2 item gagal tetap tersimpan untuk retry. | Server mengembalikan `syncedIds` berisi 8 ID. Klien hanya membersihkan 8 item tersebut dari `pendingQueue`, sedangkan 2 item invalid tetap aman di antrean. | **PASS** |
| **TEST 8** | **API / DB Error Handling**<br>1. Simulasi gangguan koneksi API / DB.<br>2. Lakukan operasi transaksi.<br>3. Periksa status data lokal. | Transaksi tidak dianggap synced palsu, melainkan tetap pending. | Klien menangani kegagalan koneksi secara anggun (*graceful*). Transaksi tetap berstatus `pending` dan antrean tidak hangus. | **PASS** |
| **TEST 9** | **API URL Alignment**<br>1. Periksa routing endpoint di Website.<br>2. Periksa routing endpoint di Capacitor native.<br>3. Verifikasi tidak ada hardcoded localhost di APK. | Website menggunakan relative path, Capacitor mengarah ke Vercel production API. | `getApiBaseUrl()` mengembalikan string kosong `""` pada browser dan `https://catatduit-seven.vercel.app` pada native Capacitor. Bebas dari localhost. | **PASS** |
| **TEST 10** | **PostgreSQL Single Source of Truth**<br>1. Lakukan mutasi bersilang di kedua platform.<br>2. Hapus local storage di salah satu klien.<br>3. Muat ulang klien tersebut. | Seluruh data pulih 100% dari PostgreSQL tanpa data loss. | Local storage berhasil di-rehydrate sepenuhnya dari PostgreSQL. Konsistensi data antara Website dan Android terjaga 100%. | **PASS** |

---

## 10. Struktur Berkas Sistem Terpadu

```
keuangan/
├── api/                         # Vercel Serverless Function Endpoints
│   ├── transactions.js          # REST Handlers GET, POST, PUT, DELETE
│   ├── sync.js                  # Batch Sync Handler (Idempotent & Partial Queue)
│   ├── categories.js            # Category CRUD & Auto-Reassign Handler
│   ├── db-status.js             # Database Health Check & Diagnostic
│   ├── summary.js               # Financial Aggregation API
│   ├── parse.js                 # Gemini AI Proxy Bridge
│   └── config.js                # Server Config Diagnostic
├── js/                          # Client Architecture Modules
│   ├── store.js                 # Core State Store, Sync Engine & Offline Queue
│   ├── parser.js                # AI Natural Language & Regex Cascade Parser
│   ├── sample-data.js           # Default Categories & Fallback Seeds
│   └── app.js                   # Application Lifecycle Orchestrator
├── android/                     # Capacitor Native Android Project
│   └── app/src/main/assets/     # Bundled Local Web Assets & Capacitor Config
├── www/                         # Distribution Assets untuk Capacitor Mobile
├── db.js                        # PostgreSQL Database Connection & Migration Adapter
├── api-handlers.js              # Business Logic & Request Handlers Terpusat
├── server.js                    # Local Development HTTP Server
├── capacitor.config.json        # Capacitor Mobile Wrapper Configuration
├── vercel.json                  # Vercel Routing, Rewrites, & CORS Headers
├── package.json                 # Project Dependencies & Build Scripts
└── keuangan/
    └── keuangan.md              # Dokumen Spesifikasi Arsitektur Sistem & Evaluasi Data
```

---

## 11. Kesimpulan Akhir & Jaminan Keandalan Sistem

Transformasi arsitektur data CatatDuit Versi 2.0 telah menyelesaikan seluruh akar masalah inkonsistensi data antara Website dan aplikasi Capacitor Android:

1. **Jaminan Integritas Data (Data Integrity Guarantee)**: Dengan menetapkan PostgreSQL Neon sebagai Single Source of Truth mutlak dan mendudukkan local storage sebagai cache pembacaan serta antrean offline, tidak ada lagi fenomena data terfragmentasi atau zombie records antar-perangkat.
2. **Jaminan Idempotensi Penuh (Zero Duplication)**: Penggunaan Client-Generated UUID dipadukan dengan klausa SQL `ON CONFLICT (id) DO UPDATE` menjamin tidak akan pernah terjadi transaksi ganda akibat kegagalan jaringan atau retry otomatis.
3. **Ketahanan Offline-First Teruji**: Seluruh operasi Create, Update, dan Delete dapat dilakukan secara offline, dicatat dalam write-ahead log, dan direkonsiliasi secara parsial tanpa kehilangan data saat koneksi kembali stabil.
4. **Portabilitas Multi-Platform**: Aplikasi mobile Capacitor dapat dibuka seketika tanpa koneksi internet (100% offline bundling) dan secara otomatis merutekan panggilan data ke Vercel production API tanpa ketergantungan konfigurasi manual.
