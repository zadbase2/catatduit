# 💸 CatatDuit — Frontend Website Pencatatan Keuangan Pribadi (AI Chatbot)

Frontend modern, estetik, dan interaktif untuk **CatatDuit** yang dibangun 100% berbasis spesifikasi **[PRD CatatDuit (keuangan.md)](./keuangan/keuangan.md)** hasil rumusan *Council Mode (4 Dewan)*.

---

## ✨ Fitur Utama Frontend

### 1. 💬 Tab Chat AI (Beranda & Natural Language Input)
- **Input Bahasa Alami (Indonesian NLP Engine)**:
  - Deteksi otomatis nominal dengan akhiran populer: `k`, `rb`, `ribu` (×1.000) dan `jt`, `juta` (×1.000.000).
  - Contoh:
    - `"baru beli esteh 2 harga 5k"` ➔ Pengeluaran: **Rp 5.000** | Kategori: **Makanan & Minuman** 🍔
    - `"gajian bulan ini 5jt"` ➔ Pemasukan: **Rp 5.000.000** | Kategori: **Gaji** 💰
    - `"bayar wifi indihome 385rb"` ➔ Pengeluaran: **Rp 385.000** | Kategori: **Tagihan & Utilitas** 💡
    - `"dapet transfer freelance 1.5jt"` ➔ Pemasukan: **Rp 1.500.000** | Kategori: **Freelance** 💻
- **Kartu Konfirmasi AI (AI Preview Card)**: Menampilkan nominal terformat Rupiah, badge kategori + ikon, confidence score akurasi (misal: 95%), serta tombol simpan/edit/batal.
- **Deteksi Ambiguitas & Klarifikasi**: Jika user hanya mengetik `"50k"`, AI akan bertanya klarifikasi: *"Untuk apa pengeluaran Rp 50.000 ini?"* lengkap dengan tombol pilihan cepat.
- **Tombol Aksi Cepat (Quick Action Chips)**: Pilihan pintas seperti ☕ Kopi, 🍚 Makan Padang, ⛽ Pertalite, 💡 Token Listrik, dan 💻 Freelance.
- **Mini Banner Ringkasan Hari Ini**: Total Masuk, Total Keluar, dan Saldo Bersih hari ini secara real-time.

### 2. 💰 Tab Pemasukan
- Kartu Hero total pemasukan dengan indikator jumlah transaksi.
- Filter rentang waktu: **Hari Ini**, **7 Hari Terakhir**, **Bulan Ini**, **Semua**.
- Filter per kategori, pencarian teks (search bar), dan pengurutan (Terbaru, Terlama, Nominal).
- Tombol **➕ Catat Pemasukan Manual** dengan modal form interaktif.
- Aksi Edit dan Hapus transaksi dengan konfirmasi.

### 3. 💸 Tab Pengeluaran
- Kartu Hero total pengeluaran.
- Widget **Pos Pengeluaran Terbesar (Top 3 Kategori)** dengan progress bar dan persentase.
- Filter lengkap dan pencarian keterangan.
- Tombol **➕ Catat Pengeluaran Manual**.

### 4. 📊 Tab Grafik & Statistik
- **Financial Health Score**: Skor kesehatan finansial (0–100) berbasis rasio tabungan dan arus kas dengan status edukatif (misal: *85/100 - Kondisi Keuangan Prima ✨*).
- **4 Kartu Metrik Ringkas**: Total Pemasukan, Total Pengeluaran, Saldo Bersih (*Net Cashflow*), dan Rasio Tabungan (*Savings Rate*).
- **Grafik Donut Interaktif**: Proporsi pengeluaran per kategori lengkap dengan hover effect, label nominal tengah, dan daftar legend responsif.
- **Grafik Batang (Bar Chart)**: Perbandingan pemasukan vs pengeluaran harian.
- **Grafik Tren Garis (Line & Area Chart)**: Tren pengeluaran 14 hari terakhir dengan gradient SVG lembut.

### 5. ⚙️ Tab Pengaturan & Offline Manager
- **Profil Pengguna**: Tampilan nama, email, dan avatar pengguna.
- **Sinkronisasi Otomatis 100% (Offline & Auto-Sync)**:
  - **Saat Offline**: Transaksi yang dicatat via Chat AI atau form manual otomatis diberi status `sync_status: 'pending'` dan disimpan ke antrean lokal (*Pending Queue*). Tampil badge `⏳ Pending` di kartu transaksi dan di balon riwayat chat.
  - **Saat Online Kembali (Otomatis)**: Aplikasi mendeteksi jaringan online (via event browser `online` maupun toggle simulator di header/pengaturan). **Tanpa perlu klik tombol apapun**, sistem langsung menyinkronkan seluruh antrean ke cloud:
    - Status transaksi otomatis berubah menjadi `synced`.
    - Badge `⏳ Pending` otomatis hilang seketika.
    - Banner antrean di Tab Chat hilang secara mulus.
    - Notifikasi toast sukses muncul: *"⚡ Online terdeteksi! X transaksi otomatis disinkronkan ke cloud & status pending dihapus."*
    - Tombol status di header dapat diklik langsung untuk simulasi switch Offline / Online secara instan.
- **Kelola Kategori**: Daftar kategori aktif dan tombol tambah kategori kustom baru (nama, tipe, emoji ikon, warna aksen).
- **Ekspor & Backup**:
  - `📥 Download Laporan (CSV)`
  - `📄 Backup Data Penuh (JSON)`
- **Manajemen Data**:
  - `🎲 Muat Ulang Data Contoh Realistis` (data transaksi Indonesia yang lengkap)
  - `🗑️ Hapus Semua Data Transaksi`
- **Tema & Tampilan**:
  - Switch Mode Gelap (Dark Mode) & Terang (Light Mode) dengan penyimpanan preferensi di `localStorage`.
  - Tombol **📱 Mobile View** di header untuk melihat aplikasi dalam mockup bezel smartphone (Capacitor preview).

---

## 🚀 Cara Menjalankan Frontend

### Opsi 1: Menjalankan Local Dev Server (Disarankan)
Buka terminal di folder `d:\downloadan\keuangan` lalu jalankan:

```bash
npm run dev
```

Buka browser dan akses:
**[http://localhost:3000](http://localhost:3000)**

### Opsi 2: Langsung Buka File HTML (Tanpa Server)
Kamu juga bisa langsung membuka file [index.html](file:///d:/downloadan/keuangan/index.html) dengan double click di file explorer browser apapun (Chrome, Edge, Firefox, dsb) karena kode dirancang 100% *client-side* tanpa dependensi kompilasi rumit!

---

## ✨ Integrasi Google AI Studio (Gemini Multi-Tier Adaptive Cascade)

Aplikasi CatatDuit terhubung langsung ke **Google AI Studio API** menggunakan arsitektur **Adaptive Fallback Cascade**:

1. **Tier 1 — Ultra-Light / Low-Token (Primary)**:
   - Model: `gemini-flash-lite-latest` / `gemini-3.5-flash-lite`
   - Respon super cepat (< 1 detik) dan sangat hemat kuota token.
2. **Tier 2 — Standard Flash (Fallback saat Sibuk / Throttled)**:
   - Model: `gemini-flash-latest` / `gemini-3.5-flash`
   - Diaktifkan otomatis jika Tier 1 mengalami error 429 / 503 / timeout.
3. **Tier 3 — Reasoning Flash**:
   - Model: `gemini-3.8-flash`
4. **Tier 4 — Local Regex Rule Engine (Emergency / Offline)**:
   - Memberikan draft transaksi instan saat jaringan offline atau tanpa koneksi internet.

### Pengujian API Key dari Terminal
Jalankan perintah berikut untuk menguji koneksi dan model:
```bash
npm test
# atau
npm run test:gemini
```

### Konfigurasi API Key
- **File `.env`**: Otomatis dibaca oleh `server.js` saat server dijalankan (`GEMINI_API_KEY=...`).
- **Tab Pengaturan UI**: User dapat melihat, mengubah, menyimpan, dan menekan tombol **⚡ Test Koneksi** secara langsung untuk memeriksa latensi server Google AI Studio secara real-time.
- **API Endpoints**:
  - `POST /api/parse`: Parse teks transaksi bebas menjadi JSON finansial.
  - `POST /api/test-gemini`: Tes koneksi & latensi round-trip ke Gemini API.
  - `GET /api/config`: Status konfigurasi API Key.

---

## 📂 Struktur File Proyek

```
d:/downloadan/keuangan/
├── .gitignore          # Proteksi secret (.env), node_modules, dan local data
├── .env                # File konfigurasi lokal (GEMINI_API_KEY & POSTGRES_URL)
├── .env.example        # Template konfigurasi environment untuk publik
├── vercel.json         # Konfigurasi Vercel: dynamic rewrites, CORS, maxDuration
├── server.js           # Server lokal Node.js (Static & REST API router)
├── db.js               # Database adapter: Vercel Postgres / Neon + local fallback
├── api-handlers.js     # Shared REST handlers untuk local server & Vercel functions
├── package.json        # Dependencies & script runner
├── api/                # Vercel Serverless Functions
│   ├── config.js       # GET /api/config (status fitur & DB, zero key leak)
│   ├── db-status.js    # GET /api/db-status (koneksi database & status engine)
│   ├── categories.js   # GET, POST, DELETE /api/categories
│   ├── transactions.js # GET, POST, PUT, DELETE /api/transactions
│   ├── summary.js      # GET /api/summary (rekap bulanan finansial)
│   ├── sync.js         # POST /api/sync (batch sinkronisasi transaksi)
│   ├── parse.js        # POST /api/parse (NLP parser Gemini cascade)
│   ├── test-gemini.js  # POST /api/test-gemini (healthcheck latency AI)
│   ├── categories/
│   │   └── [id].js     # Dynamic route handler untuk /api/categories/:id
│   └── transactions/
│       └── [id].js     # Dynamic route handler untuk /api/transactions/:id
├── test-backend.js     # Pengujian komprehensif backend & database (25 tes)
├── test-vercel-readiness.js # Pengujian kesiapan Vercel & serverless (22 tes)
├── test-gemini.js      # Pengujian live API Google AI Studio
├── index.html          # Halaman utama SPA dengan 5 tabs & modal interaktif
├── css/                # Styling CSS (style.css, components.css, responsive.css)
└── js/                 # Logika frontend (app, ui, store, parser, charts, sample-data)
```

---

## 🚢 Panduan Push ke GitHub & Hosting ke Vercel

### 1. Push ke GitHub
File `.gitignore` sudah dibuat untuk melindungi kredensial `.env` dan `node_modules`.

Jalankan perintah berikut di terminal:
```bash
# Inisialisasi git jika belum
git init

# Tambahkan semua file (kecuali yang di-ignore oleh .gitignore)
git add .

# Buat commit perdana
git commit -m "feat: complete backend and frontend ready for Vercel deployment"

# Hubungkan ke repository GitHub Anda (ganti URL dengan repo Anda)
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git

# Push ke GitHub
git push -u origin main
```

---

### 2. Hosting ke Vercel

Proyek ini telah dikonfigurasi 100% siap untuk Vercel Serverless:
- Frontend otomatis disajikan sebagai static files.
- Endpoint `/api/*` otomatis berjalan sebagai **Vercel Serverless Functions**.
- Dynamic routing `/api/transactions/:id` dan `/api/categories/:id` telah ditangani di `vercel.json` dan folder `api/`.

#### Langkah Deploy via Dashboard Vercel:
1. Buka [Vercel Dashboard](https://vercel.com/) dan klik **"Add New..."** -> **"Project"**.
2. Pilih repository GitHub yang baru Anda push.
3. Pada halaman konfigurasi project:
   - **Framework Preset**: Pilih **Other** (karena arsitektur pure static + serverless API).
   - **Root Directory**: `./` (default).
4. Di bagian **Environment Variables**, tambahkan:
   - `GEMINI_API_KEY`: *(API Key Google AI Studio Anda dari [aistudio.google.com](https://aistudio.google.com/))*
   - `POSTGRES_URL`: *(Opsional / Disarankan)* Buat database di tab **Storage -> Postgres (Neon)** di Vercel, lalu hubungkan ke project Anda. Jika belum diisi, backend otomatis menggunakan fallback memory/temp store tanpa crash!
5. Klik **"Deploy"**. Selesai! 🎉

