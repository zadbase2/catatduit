/**
 * CatatDuit - Shared API Handlers
 * Used by server.js (local node server) and Vercel serverless functions (api/*.js)
 */

const db = require('./db');
const https = require('https');

// Gemini Model Cascade
const MODEL_CASCADE = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.8-flash'
];

function callGeminiAPI(model, payloadObj, apiKey, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const payloadStr = JSON.stringify(payloadObj);
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadStr)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeoutMs}ms on model ${model}`));
    });

    req.on('error', reject);
    req.write(payloadStr);
    req.end();
  });
}

async function parseWithCascade(userText, apiKey) {
  const prompt = `Kamu adalah AI asisten keuangan pribadi bahasa Indonesia untuk aplikasi CatatDuit.
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

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt + '\n\nTeks transaksi dari pengguna: "' + userText + '"' }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  };

  let lastError = null;

  for (const model of MODEL_CASCADE) {
    try {
      const res = await callGeminiAPI(model, payload, apiKey, 5000);
      if (res.statusCode === 200) {
        const body = JSON.parse(res.data);
        const textOutput = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOutput) {
          const parsed = JSON.parse(textOutput);
          return {
            success: true,
            parsed_by: model,
            data: parsed
          };
        }
      } else {
        lastError = new Error(`Model ${model} returned status ${res.statusCode}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  return {
    success: false,
    error: lastError ? lastError.message : 'All Gemini models in cascade failed'
  };
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

// Handlers for REST Endpoints
const handlers = {
  // GET /api/db-status
  async getDbStatus(req, res) {
    const status = await db.getDbStatus();
    return { status: 200, body: { success: true, ...status } };
  },

  // GET /api/categories
  async getCategories(req, res) {
    const categories = await db.getCategories();
    return { status: 200, body: { success: true, categories } };
  },

  // POST /api/categories
  async addCategory(rawBody) {
    const body = parseBody(rawBody);
    if (!body || !body.name || !body.type) {
      return { status: 400, body: { success: false, error: 'Nama dan tipe kategori wajib diisi.' } };
    }
    const cat = await db.addCategory(body);
    return { status: 201, body: { success: true, category: cat } };
  },

  // DELETE /api/categories/:id
  async deleteCategory(id) {
    if (!id) {
      return { status: 400, body: { success: false, error: 'ID kategori wajib diisi.' } };
    }
    const result = await db.deleteCategory(id);
    if (!result.success) {
      return { status: 400, body: result };
    }
    return { status: 200, body: result };
  },

  // GET /api/transactions
  async getTransactions(query) {
    const q = query || {};
    const limit = parseInt(q.limit || '100', 10);
    const offset = parseInt(q.offset || '0', 10);
    const type = q.type || null;
    const month = q.month || null;
    const search = q.search || null;

    const data = await db.getTransactions({ limit, offset, type, month, search });
    return { status: 200, body: { success: true, ...data } };
  },

  // POST /api/transactions
  async createTransaction(rawBody) {
    const body = parseBody(rawBody);
    if (!body || !body.amount || !body.type) {
      return { status: 400, body: { success: false, error: 'Nominal dan jenis transaksi wajib diisi.' } };
    }
    const tx = await db.createTransaction(body);
    return { status: 201, body: { success: true, transaction: tx } };
  },

  // PUT /api/transactions/:id
  async updateTransaction(id, rawBody) {
    if (!id) {
      return { status: 400, body: { success: false, error: 'ID transaksi wajib diisi.' } };
    }
    const body = parseBody(rawBody);
    const tx = await db.updateTransaction(id, body);
    if (!tx) {
      return { status: 404, body: { success: false, error: 'Transaksi tidak ditemukan.' } };
    }
    return { status: 200, body: { success: true, transaction: tx } };
  },

  // DELETE /api/transactions/:id
  async deleteTransaction(id) {
    if (!id) {
      return { status: 400, body: { success: false, error: 'ID transaksi wajib diisi.' } };
    }
    const ok = await db.deleteTransaction(id);
    if (!ok) {
      return { status: 404, body: { success: false, error: 'Transaksi tidak ditemukan.' } };
    }
    return { status: 200, body: { success: true, id, message: 'Transaksi berhasil dihapus.' } };
  },

  // POST /api/sync
  async syncTransactions(rawBody) {
    const body = parseBody(rawBody);
    const items = Array.isArray(body) ? body : (body.items || []);
    const results = await db.batchSync(items);
    return { status: 200, body: { success: true, ...results } };
  },

  // GET /api/summary
  async getSummary(query) {
    const q = query || {};
    const month = q.month || null;
    const summary = await db.getSummary(db.DEFAULT_USER.id, month);
    return { status: 200, body: { success: true, summary } };
  },

  // POST /api/parse
  async parseTransaction(rawBody, defaultKey) {
    const body = parseBody(rawBody);
    const text = body.text || '';
    const apiKey = body.apiKey || defaultKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { status: 400, body: { success: false, error: 'Google AI Studio API Key belum dikonfigurasi di server (.env atau Vercel).' } };
    }
    if (!text.trim()) {
      return { status: 400, body: { success: false, error: 'Teks transaksi tidak boleh kosong.' } };
    }
    const result = await parseWithCascade(text, apiKey);
    return { status: result.success ? 200 : 502, body: result };
  },

  // POST /api/test-gemini
  async testGemini(rawBody, defaultKey) {
    const body = parseBody(rawBody);
    const keyToTest = body.apiKey || defaultKey || process.env.GEMINI_API_KEY;
    if (!keyToTest) {
      return { status: 400, body: { success: false, error: 'Google AI Studio API Key belum dikonfigurasi.' } };
    }
    const start = Date.now();

    const testPayload = {
      contents: [{ parts: [{ text: 'Ping test. Jawab JSON: {"status": "ok"}' }] }],
      generationConfig: { responseMimeType: 'application/json' }
    };

    let successModel = null;
    let latency = 0;
    for (const model of MODEL_CASCADE) {
      try {
        const resModel = await callGeminiAPI(model, testPayload, keyToTest, 4000);
        if (resModel.statusCode === 200) {
          successModel = model;
          latency = Date.now() - start;
          break;
        }
      } catch {
        // try next
      }
    }

    if (successModel) {
      return {
        status: 200,
        body: {
          success: true,
          activeModel: successModel,
          latencyMs: latency,
          message: `Berhasil terhubung ke Google AI Studio via ${successModel} (${latency}ms)`
        }
      };
    }

    return {
      status: 500,
      body: {
        success: false,
        error: 'Gagal terhubung ke model Gemini. Cek koneksi atau kuota API Key.'
      }
    };
  }
};

module.exports = {
  handlers,
  MODEL_CASCADE,
  callGeminiAPI,
  parseWithCascade
};
