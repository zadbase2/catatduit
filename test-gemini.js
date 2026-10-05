const https = require('https');
const fs = require('fs');
const path = require('path');

// Auto-load .env for local testing if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const API_KEY = process.env.GEMINI_API_KEY || '';

async function parseTransactionWithGemini(userText, model = 'gemini-flash-lite-latest') {
  const systemPrompt = `Kamu adalah AI asisten keuangan pribadi bahasa Indonesia untuk aplikasi CatatDuit.
Tugas kamu adalah mengekstrak teks transaksi percakapan sehari-hari menjadi format JSON terstruktur.

Kategori Pemasukan yang valid:
- Gaji (💰)
- Freelance (💻)
- Investasi (📈)
- Hadiah (🎁)
- Lainnya (📦)

Kategori Pengeluaran yang valid:
- Makanan & Minuman (🍔)
- Transportasi (🚗)
- Belanja (🛒)
- Hiburan (🎮)
- Tagihan & Utilitas (💡)
- Kesehatan (💊)
- Pendidikan (📚)
- Lainnya (📦)

Aturan parsing bahasa Indonesia:
- "5k" = 5000, "50rb" = 50000, "1.5jt" / "1,5 juta" = 1500000, "25 ribu" = 25000, "rp 30.000" = 30000.
- Ekstrak keterangan (description) menjadi bersih dan kapitalisasi yang pantas (misal "Makan Soto Ayam", "Beli Es Teh").
- Jika input hanya angka/nominal tanpa konteks untuk apa, set needs_clarification=true dan buat clarification_question dalam bahasa Indonesia ramah.

Kembalikan HANYA format JSON valid:
{
  "type": "income" | "expense",
  "amount": 25000,
  "description": "Beli Es Teh 2",
  "category_name": "Makanan & Minuman",
  "category_icon": "🍔",
  "confidence": 0.95,
  "needs_clarification": false,
  "clarification_question": null
}`;

  const payload = JSON.stringify({
    contents: [
      {
        parts: [
          { text: systemPrompt + '\n\nTeks transaksi dari pengguna: "' + userText + '"' }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const textResult = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            resolve({ success: true, model, data: JSON.parse(textResult) });
          } catch (e) {
            resolve({ success: false, model, error: 'JSON parse error', raw: data });
          }
        } else {
          resolve({ success: false, model, statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  const tests = [
    'beli esteh 2 seharga 5k',
    'dapat transferan freelance desain web 1.2jt',
    'isi bensin pertamax 50rb di spbu shell',
    'bayar kosan bulan maret 1.500.000',
    '100rb'
  ];

  if (!API_KEY) {
    console.error('⚠️ GEMINI_API_KEY tidak ditemukan di .env atau environment variables. Silakan set di file .env.');
    return;
  }
  console.log('Testing Gemini AI Transaction Parser with API Key:', API_KEY.slice(0, 8) + '...' + API_KEY.slice(-4));
  for (const t of tests) {
    console.log(`\nInput: "${t}"`);
    const res = await parseTransactionWithGemini(t);
    console.log('Result:', JSON.stringify(res.data, null, 2));
  }
}

run();
