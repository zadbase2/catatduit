# 📋 Project Requirement Document (PRD)
# CatatDuit — Pencatatan Keuangan Pribadi Berbasis AI Chatbot

> **Versi**: 1.0  
> **Tanggal**: 3 Oktober 2026  
> **Status**: Draft — Menunggu Review  
> **Disusun oleh**: Council Mode (4 Dewan)

---

## 1. Visi Produk

**CatatDuit** adalah aplikasi pencatatan keuangan pribadi yang memungkinkan user mencatat pemasukan dan pengeluaran cukup dengan **mengetik kalimat natural** seperti chat sehari-hari. AI (Google Gemini) akan otomatis mem-parsing teks menjadi data terstruktur.

**Contoh penggunaan:**
```
User: "baru beli esteh 2 harga 5k"
AI Parse → Pengeluaran: Rp 5.000 | Kategori: Minuman | Item: Esteh x2

User: "gajian bulan ini 5jt"
AI Parse → Pemasukan: Rp 5.000.000 | Kategori: Gaji | Keterangan: Gaji bulanan
```

### Unique Selling Points
1. **Chatbot-based input** — Tidak perlu isi form, cukup ketik seperti chat
2. **Offline-first** — Berfungsi tanpa internet, sync otomatis saat online
3. **Mobile app** — Bisa diinstall di HP via Capacitor
4. **AI-powered categorization** — Otomatis kategorisasi dan parsing nominal

---

## 2. Tech Stack

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| **Frontend** | Next.js 14+ (App Router) | SSR, API routes, static export untuk Capacitor |
| **Styling** | Tailwind CSS | Mobile-first, utility-based, dark mode support |
| **Database (Cloud)** | Vercel Postgres (Neon) | Hosting & DB satu platform, serverless-friendly |
| **Database (Local)** | IndexedDB via Dexie.js | Offline storage, rich querying, observer API |
| **AI** | Google Gemini Multi-Tier (Primary: Gemini 2.0 Flash Lite, Fallback: Gemini 2.0 Flash) | Mengutamakan model token terendah & termurah, auto-switch otomatis jika model sibuk/rate limit |
| **Concurrency / UX** | Background Queue Worker & Optimistic UI | Non-blocking input (transaksi langsung berstatus pending di background, tanpa freezing/loading spinner) |
| **Mobile Wrapper** | Capacitor | Web → native app, akses plugin native |
| **Offline** | Service Worker + Workbox | Caching, background sync |
| **Charts** | Chart.js / Recharts | Grafik interaktif, ringan |
| **Auth** | NextAuth.js / Clerk | Authentication (opsional untuk MVP) |
| **State Management** | Zustand + Dexie.js Reactive Store | Ringan, simple, manajemen offline queue & pending state |

---

## 3. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser/App)                  │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   UI     │  │  Zustand     │  │   Dexie.js        │  │
│  │  (Next)  │←→│  (State)     │←→│  (IndexedDB)      │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│                       ↕                    ↕             │
│              ┌────────────────┐   ┌────────────────┐    │
│              │ Service Worker │   │ Sync Manager   │    │
│              │ (Offline Cache)│   │ (Queue & Push) │    │
│              └────────────────┘   └────────────────┘    │
└───────────────────────┬─────────────────┬───────────────┘
                        │ (saat online)   │
                        ↓                 ↓
┌───────────────────────────────────────────────────────────┐
│                   VERCEL (Server)                         │
│                                                           │
│  ┌─────────────────┐     ┌─────────────────────────────┐  │
│  │  API Routes     │────→│  Vercel Postgres (Neon)     │  │
│  │  /api/sync      │     │  - users                    │  │
│  │  /api/parse     │     │  - transactions             │  │
│  │  /api/summary   │     │  - categories               │  │
│  └────────┬────────┘     │  - monthly_summaries        │  │
│           │              └─────────────────────────────┘  │
│           ↓                                               │
│  ┌─────────────────┐                                      │
│  │  Google Gemini  │                                      │
│  │  API (parse)    │                                      │
│  └─────────────────┘                                      │
└───────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### 4.1 Vercel Postgres (Cloud)

```sql
-- Tabel Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabel Categories (default + custom user)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(50) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('income', 'expense')),
    icon VARCHAR(10),        -- emoji icon
    color VARCHAR(7),        -- hex color
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabel Transactions (core)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('income', 'expense')) NOT NULL,
    category_id UUID REFERENCES categories(id),
    description VARCHAR(255),
    raw_input TEXT,               -- teks asli dari user
    ai_confidence DECIMAL(3, 2), -- confidence score AI parsing
    transaction_date DATE NOT NULL,
    device_id VARCHAR(100),      -- untuk conflict resolution
    version INTEGER DEFAULT 1,   -- optimistic locking
    sync_status VARCHAR(10) DEFAULT 'synced',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index untuk performa query
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX idx_transactions_sync ON transactions(sync_status) WHERE sync_status != 'synced';

-- Tabel Monthly Summaries (cache untuk performa)
CREATE TABLE monthly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    year_month VARCHAR(7) NOT NULL,  -- format: '2026-10'
    total_income DECIMAL(15, 2) DEFAULT 0,
    total_expense DECIMAL(15, 2) DEFAULT 0,
    balance DECIMAL(15, 2) DEFAULT 0,
    category_breakdown JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, year_month)
);
```

### 4.2 IndexedDB Schema (Dexie.js — Local)

```javascript
const db = new Dexie('CatatDuitDB');

db.version(1).stores({
    transactions: 'id, type, category_id, transaction_date, sync_status',
    categories: 'id, type, is_default',
    pendingQueue: '++id, action, entity, created_at',  // offline queue
    settings: 'key'  // user preferences
});
```

### 4.3 Default Categories

| Type | Kategori | Icon |
|------|----------|------|
| Expense | Makanan & Minuman | 🍔 |
| Expense | Transportasi | 🚗 |
| Expense | Belanja | 🛒 |
| Expense | Hiburan | 🎮 |
| Expense | Tagihan & Utilitas | 💡 |
| Expense | Kesehatan | 💊 |
| Expense | Pendidikan | 📚 |
| Expense | Lainnya | 📦 |
| Income | Gaji | 💰 |
| Income | Freelance | 💻 |
| Income | Investasi | 📈 |
| Income | Hadiah | 🎁 |
| Income | Lainnya | 📦 |

---

## 5. Gemini AI Integration

### 5.1 Prompt Engineering

```
System Prompt:
Kamu adalah asisten parsing transaksi keuangan. Tugas kamu mengubah
teks natural language dari user menjadi data transaksi terstruktur
dalam format JSON.

Aturan:
- "k" = ribu (5k = 5000), "jt" = juta (5jt = 5000000)
- Tentukan apakah ini "income" atau "expense" dari konteks
- Jika tanggal tidak disebutkan, gunakan hari ini
- Berikan confidence score 0.0-1.0
- Selalu kembalikan JSON valid, tanpa markdown code block

Output format:
{
  "type": "income" | "expense",
  "amount": number,
  "description": string,
  "category_suggestion": string,
  "transaction_date": "YYYY-MM-DD",
  "confidence": number,
  "needs_clarification": boolean,
  "clarification_question": string | null
}
```

### 5.2 Contoh Input → Output

| Input User | Output AI |
|-----------|-----------|
| "beli esteh 2 harga 5k" | `{type:"expense", amount:5000, description:"Esteh x2", category:"Makanan & Minuman", confidence:0.92}` |
| "gajian 5jt" | `{type:"income", amount:5000000, description:"Gaji", category:"Gaji", confidence:0.95}` |
| "bayar listrik 350rb" | `{type:"expense", amount:350000, description:"Bayar listrik", category:"Tagihan & Utilitas", confidence:0.97}` |
| "dapet bonus 2jt dari kantor" | `{type:"income", amount:2000000, description:"Bonus kantor", category:"Gaji", confidence:0.90}` |
| "50k" | `{type:"expense", amount:50000, description:"Pengeluaran", category:"Lainnya", confidence:0.5, needs_clarification:true, clarification_question:"Untuk apa pengeluaran 50k ini?"}` |

### 5.3 Offline Fallback Parser (Regex-based)

Saat offline, gunakan rule-based parser sederhana untuk parsing dasar:

```javascript
// Pattern: "beli [item] [harga]", "[nominal]k/jt untuk [item]", dll.
function offlineParse(text) {
    const amountRegex = /(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta)/gi;
    const isIncome = /gaji|terima|dapat|dapet|masuk|income|bayaran|transfer\smasuk/i.test(text);
    // ... parse nominal dan kembalikan data parsial
    // Tandai dengan flag: ai_processed: false
    // Akan di-reprocess oleh Gemini saat online
}
```

### 5.4 Smart Model Fallback Cascade & Cost/Token Optimizer

Secara bawaan, Google AI Studio API tidak melakukan *auto-switch* model jika terjadi *rate limit* atau server sibuk. Oleh karena itu, aplikasi CatatDuit menerapkan **Adaptive Fallback Cascade** di level orchestrator (`/api/parse` atau client worker):

#### Hirarki Prioritas Model:
1. **Tier 1 — Ultra-Light / Low-Token (Primary)**:
   - Model: `gemini-2.0-flash-lite` (atau `gemini-1.5-flash-8b`)
   - Tujuan: Konsumsi token paling hemat, latensi tercepat (< 400ms), memaksimalkan kuota gratis (free tier limits)
   - Max output tokens dibatasi ketat: 150 token (cukup untuk payload JSON transaksi)
2. **Tier 2 — Standard Flash (Fallback saat Tier 1 Sibuk / Throttled)**:
   - Model: `gemini-2.0-flash`
   - Trigger Fallback: Terjadi error HTTP `429` (Rate limit / Too Many Requests), HTTP `503` (Model Overloaded / Service Unavailable), atau Request Timeout (> 4 detik)
   - Kelebihan: Throughput lebih stabil dan kapasitas server lebih tinggi
3. **Tier 3 — Local Regex Rule-Based (Emergency / Offline Fallback)**:
   - Dieksekusi jika koneksi internet terputus atau kedua model API Gemini sedang bermasalah
   - Memberikan hasil ekstraksi instan secara lokal tanpa AI

```typescript
// Konfigurasi & Rantai Fallback Model
const MODEL_CASCADE = [
  {
    tier: 1,
    model: 'gemini-2.0-flash-lite',
    timeoutMs: 4000,
    maxTokens: 150,
    description: 'Prioritas utama: hemat token & super cepat'
  },
  {
    tier: 2,
    model: 'gemini-2.0-flash',
    timeoutMs: 6000,
    maxTokens: 200,
    description: 'Fallback otomatis jika flash-lite rate-limited (429) / busy (503)'
  }
];

async function parseWithFallback(prompt: string, apiKey: string) {
  for (const config of MODEL_CASCADE) {
    try {
      const response = await callGeminiWithTimeout(config.model, prompt, apiKey, config.timeoutMs);
      return { ...response, parsed_by: config.model };
    } catch (err: any) {
      const isBusyOrThrottled = err.status === 429 || err.status === 503 || err.name === 'AbortError';
      if (!isBusyOrThrottled && config.tier === MODEL_CASCADE.length) throw err;
      console.warn(`[AI Cascade] Model ${config.model} busy/failed (${err.message}), beralih ke tier berikutnya...`);
    }
  }
  // Jika semua AI gagal -> Fallback ke Local Regex
  return { ...offlineParse(prompt), parsed_by: 'local_regex_fallback' };
}
```

---

### 5.5 Non-Blocking Optimistic UI & Asynchronous Pending Queue

Untuk memberikan pengalaman pengguna yang sangat mulus (*zero-lag user experience*), aplikasi **TIDAK MENGGUNAKAN LOADING SPINNER / MODAL FREEZE** saat proses request AI atau pergantian model (failover) berlangsung.

#### Mekanisme Alur Non-Blocking:
1. **Instant Chat & Optimistic Render**:
   - Saat tombol kirim/Enter ditekan, input chat langsung dibersihkan (*cleared*) seketika.
   - Pesan user langsung muncul di UI dengan status transaksi **`⏳ Pending (Memproses di background)`**.
   - User bebas langsung mengetik transaksi kedua/ketiga, membuka menu grafik, atau berpindah tab tanpa terhalang.
2. **Background AI Queue Worker**:
   - Transaksi baru masuk ke antrean lokal `pendingAIQueue` (disimpan sementara di IndexedDB agar aman jika app di-refresh).
   - Antrean diproses satu per satu di background secara asinkron.
   - Di background, sistem mengeksekusi Fallback Cascade (Tier 1 Flash-Lite → Tier 2 Flash jika sibuk).
3. **Smooth State Transition (Micro-Interactions)**:
   - Begitu AI selesai mem-parsing di background:
     - Badge transaksi berubah halus dengan animasi fade: dari `⏳ Pending` menjadi `🤖 Gemini Flash-Lite` (atau model fallback yang berhasil).
     - Data hasil parsing (nominal, kategori, keterangan) otomatis terisi.
     - Bunyi subtle haptic feedback atau update ringkasan saldo tanpa popup mengganggu.
   - Jika membutuhkan klarifikasi: Muncul chip pertanyaan klarifikasi interaktif di bawah chat tersebut.
4. **Lifecycle Status Transaksi**:
   - `pending_queue`: Transaksi baru masuk, menunggu giliran worker.
   - `processing_ai`: Worker sedang menghubungi model Gemini di background.
   - `parsed`: Berhasil diurai oleh AI, menunggu review user / auto-confirm.
   - `fallback_regex`: AI sedang sibuk/offline, data sementara diisi oleh regex lokal dengan badge `⚡ Auto-Draft (Perlu Cek)`.

---

## 6. Offline & Sync Strategy

### 6.1 Alur Non-Blocking Input & Sync Strategy

```
User ketik "beli kopi 15k" & tekan Kirim
    │
    ▼
[INSTANT OPTIMISTIC UI]
- Input box langsung bersih (siap ketik lagi)
- Chat bubble muncul seketika berstatus "⏳ Pending di Antrean"
- TIDAK ADA LOADING SCREEN / SPINNER PEMBLOKIR
    │
    ▼
[BACKGROUND AI QUEUE WORKER]
    │
    ├─ SAAT ONLINE ──→ Eksekusi AI Fallback Cascade:
    │                  1. Coba Tier 1: Gemini 2.0 Flash Lite (Hemat Token)
    │                  2. Jika Sibuk (429/503/timeout) ──→ Auto-switch Tier 2: Gemini 2.0 Flash
    │                  3. Jika Berhasil ──→ Badge berganti halus ke "🤖 AI Parsed"
    │                                  ──→ Simpan ke IndexedDB + Postgres
    │
    └─ SAAT OFFLINE / SEMUA AI SIBUK:
                       ──→ Eksekusi Tier 3: Local Offline Parser (Regex)
                       ──→ Simpan ke IndexedDB (sync_status: 'pending')
                       ──→ Badge berganti halus ke "⚡ Offline Draft (⏳ Menunggu Sync)"

Saat kembali ONLINE:
    │
    pendingQueue items ──→ Batch kirim ke /api/sync
    ──→ Server/Worker: re-parse dengan Gemini AI (yang masih draft regex)
    ──→ Server: simpan ke Postgres
    ──→ Return hasil ──→ Update IndexedDB (sync_status: 'synced')
    ──→ Tampilkan notifikasi halus "✅ Transaksi berhasil diselaraskan"
```

### 6.2 Sync Rules

1. **IndexedDB = Source of Truth lokal** — UI selalu baca dari sini
2. **Vercel Postgres = Source of Truth global** — backup & cross-device
3. **Conflict Resolution**: `version` field + last-write-wins
4. **Batch Sync**: Kirim max 50 pending items per request
5. **Retry Logic**: Exponential backoff (1s, 2s, 4s, max 30s) jika gagal
6. **Network Detection**: `navigator.onLine` + `fetch` health check ke `/api/ping`

### 6.3 Service Worker Strategy

```
- Static assets: Cache-First (CSS, JS, images)
- API calls: Network-First with fallback ke cache
- Sync: Background Sync API untuk pending transactions
```

---

## 7. UI/UX Design

### 7.1 Navigasi (Bottom Tab — Mobile-first)

```
┌─────────────────────────────────────────┐
│              CatatDuit                  │
│         ┌──────────────────┐            │
│         │ [Offline ⏳]     │            │
│         └──────────────────┘            │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │        CONTENT AREA             │    │
│  │      (berubah per tab)          │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────┬──────┬──────┬──────┬──────┐   │
│  │ 💬  │  💰  │  💸  │  📊  │  ⚙️  │   │
│  │Chat │Masuk │Keluar│Grafik│Atur  │   │
│  └─────┴──────┴──────┴──────┴──────┘   │
└─────────────────────────────────────────┘
```

### 7.2 Tab Detail

#### 💬 Tab Chat (Beranda)
- **Input area** di bawah (seperti WhatsApp)
- Menampilkan riwayat percakapan: input user → hasil parsing AI
- Setiap hasil parsing bisa di-**edit** atau **hapus**
- Quick action buttons: "☕ Kopi", "🍚 Makan", "🚗 Transport" (customizable)
- Banner status sync di atas (jika ada pending items)
- **Ringkasan hari ini**: Total pemasukan & pengeluaran hari ini

#### 💰 Tab Pemasukan
- List pemasukan dengan filter:
  - Rentang waktu (Hari ini / Minggu ini / Bulan ini / Custom range)
  - Kategori
  - Pencarian teks
- Sort by: Tanggal / Nominal
- Total pemasukan ditampilkan di atas
- Swipe untuk edit/hapus (mobile gesture)

#### 💸 Tab Pengeluaran
- Sama seperti Tab Pemasukan, tapi untuk pengeluaran
- Tambahan: **Top 3 kategori pengeluaran** bulan ini

#### 📊 Tab Grafik/Statistik
- **Grafik Donut**: Breakdown pengeluaran per kategori
- **Grafik Bar**: Perbandingan pemasukan vs pengeluaran (bulanan)
- **Grafik Line**: Tren pengeluaran harian dalam sebulan
- **Selector rentang waktu**: 7 hari / 30 hari / 3 bulan / 6 bulan / 1 tahun / Custom
- **Ringkasan angka**: Total pemasukan, total pengeluaran, saldo/selisih

#### ⚙️ Tab Pengaturan
- Profil user
- Kelola kategori (tambah/edit/hapus)
- Quick action buttons (custom shortcuts)
- Mata uang (default: IDR)
- Export data (CSV/PDF)
- Hapus semua data
- Tentang aplikasi

### 7.3 Design System

| Elemen | Spesifikasi |
|--------|-------------|
| **Primary Color** | `#2563EB` (Blue 600) |
| **Income Color** | `#10B981` (Emerald 500) |
| **Expense Color** | `#EF4444` (Red 500) |
| **Background** | `#F8FAFC` (light) / `#0F172A` (dark) |
| **Font** | Inter (Google Fonts) |
| **Border Radius** | 12px (cards), 24px (buttons) |
| **Shadows** | Subtle, multi-layered |
| **Dark Mode** | Ya, toggle di pengaturan |
| **Animations** | Framer Motion — slide, fade, spring |

---

## 8. API Routes

| Method | Endpoint | Fungsi | Auth |
|--------|----------|--------|------|
| POST | `/api/auth/login` | Login user | ❌ |
| POST | `/api/auth/register` | Register user | ❌ |
| POST | `/api/parse` | Kirim teks → Gemini parse → return JSON | ✅ |
| POST | `/api/sync` | Batch sync pending transactions | ✅ |
| GET | `/api/transactions` | Get transaksi (paginated, filtered) | ✅ |
| PUT | `/api/transactions/:id` | Update transaksi | ✅ |
| DELETE | `/api/transactions/:id` | Hapus transaksi | ✅ |
| GET | `/api/summary` | Get ringkasan (bulanan/custom range) | ✅ |
| GET | `/api/categories` | Get daftar kategori | ✅ |
| POST | `/api/categories` | Tambah kategori custom | ✅ |
| GET | `/api/ping` | Health check (untuk deteksi online) | ❌ |

---

## 9. Capacitor Configuration

### 9.1 Build Flow

```
Next.js build (static export)
    → output: out/
    → npx cap copy
    → npx cap open android / ios
```

### 9.2 Capacitor Plugins

| Plugin | Fungsi |
|--------|--------|
| `@capacitor/network` | Deteksi status jaringan |
| `@capacitor/app` | App lifecycle events |
| `@capacitor/haptics` | Feedback haptic saat transaksi tersimpan |
| `@capacitor/status-bar` | Kustomisasi status bar |
| `@capacitor/splash-screen` | Splash screen native |
| `@capacitor/keyboard` | Keyboard handling (chatbox) |

### 9.3 capacitor.config.ts

```typescript
const config: CapacitorConfig = {
    appId: 'com.catatduit.app',
    appName: 'CatatDuit',
    webDir: 'out',
    server: {
        // Saat development, point ke Vercel URL
        // Saat production, gunakan local files
        url: process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3000' 
            : undefined,
        cleartext: true
    },
    plugins: {
        SplashScreen: {
            launchAutoHide: true,
            androidScaleType: 'CENTER_CROP'
        }
    }
};
```

---

## 10. Roadmap & Milestones

### Fase 1: MVP Core (Minggu 1-3)
- [ ] Setup Next.js + Vercel Postgres + Tailwind
- [ ] Database schema & migration
- [ ] Integrasi Gemini AI Multi-Tier (Flash Lite → Flash fallback cascade)
- [ ] Non-blocking Optimistic UI & background AI processing queue
- [ ] UI: Tab Chat + input transaksi (zero-loading freeze)
- [ ] UI: Tab Pemasukan & Pengeluaran (list view)
- [ ] IndexedDB setup dengan Dexie.js
- [ ] Basic offline: simpan ke IndexedDB saat offline
- [ ] Deploy ke Vercel

### Fase 2: Sync & Insights (Minggu 4-5)
- [ ] Background sync (Service Worker)
- [ ] Offline queue & batch sync
- [ ] Offline fallback parser (regex)
- [ ] UI: Tab Grafik (donut + bar chart)
- [ ] Filter rentang waktu
- [ ] Monthly summary API & caching

### Fase 3: Mobile App (Minggu 6-7)
- [ ] Capacitor integration
- [ ] Static export configuration
- [ ] Android build & test
- [ ] Native plugins (network, haptics, splash)
- [ ] PWA manifest & icons

### Fase 4: Polish & Enhancement (Minggu 8+)
- [ ] Dark mode
- [ ] Quick action templates
- [ ] Export CSV/PDF
- [ ] Conversational insights ("berapa pengeluaran minggu ini?")
- [ ] Financial health score
- [ ] Auth (jika multi-device sync dibutuhkan)
- [ ] Animasi & micro-interactions

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| AI salah parse transaksi | Data keuangan tidak akurat | Konfirmasi user sebelum simpan + tombol edit |
| Vercel Postgres limit (free tier) | App berhenti saat limit tercapai | Monitor usage, upgrade plan, atau archival strategy |
| Gemini API rate limiting / Model busy (429/503) | Gagal parse / respons lambat saat jam sibuk | Smart Fallback Cascade (Tier 1 Flash-Lite → Tier 2 Flash), background queue tanpa blocking, local regex fallback |
| Sync conflict multi-device | Data duplikat/hilang | Version-based conflict resolution + notifikasi user |
| Capacitor compatibility | UI tidak sempurna di native | Testing di device fisik, responsive design |
| Data privasi | User khawatir data keuangan dikirim ke AI | Informasi jelas di onboarding, minimal data ke API |

---

## 12. Definition of Done (MVP)

- [ ] User bisa mengetik transaksi dalam bahasa natural dan ter-parse otomatis
- [ ] Transaksi tersimpan dan tampil di tab Pemasukan/Pengeluaran
- [ ] App berfungsi offline (input tersimpan lokal)
- [ ] Data sync otomatis saat kembali online
- [ ] Grafik dasar (donut per kategori) berfungsi
- [ ] Filter rentang waktu berfungsi
- [ ] Responsive di mobile (min 360px width)
- [ ] Deploy sukses di Vercel
- [ ] Build Capacitor Android berhasil

---

## 13. Struktur Folder Proyek (Rencana)

```
catatduit/
├── public/
│   ├── icons/              # App icons untuk PWA & Capacitor
│   └── manifest.json       # PWA manifest
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Halaman utama (redirect ke /chat)
│   │   ├── chat/           # Tab Chat
│   │   ├── income/         # Tab Pemasukan
│   │   ├── expense/        # Tab Pengeluaran
│   │   ├── stats/          # Tab Grafik
│   │   ├── settings/       # Tab Pengaturan
│   │   └── api/            # API Routes
│   │       ├── parse/
│   │       ├── sync/
│   │       ├── transactions/
│   │       ├── summary/
│   │       ├── categories/
│   │       └── ping/
│   ├── components/         # Reusable components
│   │   ├── ui/             # Atomic UI (Button, Card, Input, etc.)
│   │   ├── chat/           # Chat-specific components
│   │   ├── charts/         # Chart components
│   │   └── layout/         # Navigation, Header, BottomTab
│   ├── lib/                # Utilities & helpers
│   │   ├── db.ts           # Dexie.js IndexedDB setup
│   │   ├── postgres.ts     # Vercel Postgres connection
│   │   ├── gemini.ts       # Gemini API client
│   │   ├── sync.ts         # Sync manager
│   │   ├── offline-parser.ts # Regex-based fallback parser
│   │   └── utils.ts        # Format rupiah, date helpers, etc.
│   ├── stores/             # Zustand stores
│   │   ├── transaction.ts
│   │   └── sync.ts
│   └── types/              # TypeScript types
│       └── index.ts
├── capacitor.config.ts     # Capacitor config
├── next.config.js          # Next.js config (static export)
├── tailwind.config.ts
├── package.json
└── README.md
```

---

> **Catatan**: Dokumen ini adalah draft awal hasil diskusi Council 4 Dewan. Silakan review dan berikan feedback untuk iterasi selanjutnya.
