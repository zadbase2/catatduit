/**
 * CatatDuit - Indonesian AI Natural Language Parser
 * Based on PRD section 5 (Gemini AI parsing simulation & offline regex fallback)
 */

class AIParser {
  constructor(categories = []) {
    this.categories = categories;
  }

  setCategories(categories) {
    this.categories = categories;
  }

  /**
   * Parse Indonesian currency and amount strings
   * Examples: "5k" -> 5000, "50rb" -> 50000, "1.5jt" -> 1500000, "Rp 25.000" -> 25000
   */
  parseAmount(text) {
    if (!text) return null;

    // Pattern for Million: "5jt", "1.5 jt", "2,5 juta"
    const jtMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)\b/i);
    if (jtMatch) {
      const num = parseFloat(jtMatch[1].replace(',', '.'));
      return Math.round(num * 1000000);
    }

    // Pattern for Thousand: "5k", "50rb", "25 ribu", "100 k"
    const kMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:k|rb|ribu)\b/i);
    if (kMatch) {
      const num = parseFloat(kMatch[1].replace(',', '.'));
      return Math.round(num * 1000);
    }

    // Pattern for plain numbers with Rp: "rp 50000", "rp. 50.000", "rp50,000"
    const rpMatch = text.match(/rp\.?\s*([\d.,]+)/i);
    if (rpMatch) {
      const clean = rpMatch[1].replace(/[.,]/g, '');
      const num = parseInt(clean, 10);
      if (!isNaN(num) && num > 0) return num;
    }

    // Plain numbers with thousand separators like "25.000" or "50,000"
    const formattedNumMatch = text.match(/\b\d{1,3}(?:[.,]\d{3})+\b/);
    if (formattedNumMatch) {
      const clean = formattedNumMatch[0].replace(/[.,]/g, '');
      const num = parseInt(clean, 10);
      if (!isNaN(num) && num > 0) return num;
    }

    // Plain 4+ digit number or standalone number
    const plainMatch = text.match(/\b\d+\b/);
    if (plainMatch) {
      const num = parseInt(plainMatch[0], 10);
      // If user typed e.g. 50, but meant 50k? In finance apps, usually > 100 or standalone
      if (!isNaN(num) && num > 0) return num;
    }

    return null;
  }

  /**
   * Determine transaction type (income / expense)
   */
  determineType(text) {
    const incomeKeywords = [
      'gaji', 'gajian', 'salary', 'payroll', 'terima', 'dapat', 'dapet',
      'masuk', 'transfer masuk', 'income', 'bayaran', 'freelance', 'cair',
      'bonus', 'thr', 'dividen', 'profit', 'hadiah', 'reksadana', 'penjualan',
      'laba', 'hasil usaha', 'angpao', 'saweran'
    ];

    const lower = text.toLowerCase();
    for (const kw of incomeKeywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
        return 'income';
      }
    }

    return 'expense'; // default is expense
  }

  /**
   * Detect category based on Indonesian keywords
   */
  detectCategory(text, type) {
    const lower = text.toLowerCase();

    if (type === 'income') {
      if (/gaji|gajian|salary|payroll|upah|thr|bonus\s*(kantor|tahunan)?/i.test(lower)) {
        return { name: 'Gaji', icon: '💰', id: 'cat-inc-1' };
      }
      if (/freelance|proyek|project|klien|desain|coding|side\s*job|fee|honor/i.test(lower)) {
        return { name: 'Freelance', icon: '💻', id: 'cat-inc-2' };
      }
      if (/dividen|saham|crypto|investasi|reksadana|bunga|deposito|emas|bibit|bareksa/i.test(lower)) {
        return { name: 'Investasi', icon: '📈', id: 'cat-inc-3' };
      }
      if (/hadiah|kado|angpao|giveaway|traktir|sawer/i.test(lower)) {
        return { name: 'Hadiah', icon: '🎁', id: 'cat-inc-4' };
      }
      return { name: 'Lainnya', icon: '📦', id: 'cat-inc-5' };
    }

    // Expense categorization
    if (/esteh|es\s*teh|kopi|coffee|americano|latte|nasi|padang|warteg|makan|minum|jajan|sarapan|lunch|dinner|ayam|bebek|soto|bakso|mie|indomie|burger|pizza|mcd|kfc|boba|snack|roti|martabak|nongkrong/i.test(lower)) {
      return { name: 'Makanan & Minuman', icon: '🍔', id: 'cat-exp-1' };
    }
    if (/bensin|pertalite|pertamax|spbu|solar|shell|gojek|goride|gocar|grab|grabcar|ojol|ojek|taxi|taksi|parkir|tol|krl|mrt|lrt|busway|transjakarta|kereta|pesawat|tambal\s*ban|cuci\s*motor|cuci\s*mobil|tarif/i.test(lower)) {
      return { name: 'Transportasi', icon: '🚗', id: 'cat-exp-2' };
    }
    if (/belanja|supermarket|minimarket|indomaret|alfamart|mall|shopee|tokped|tokopedia|tiktok\s*shop|lazada|baju|kaos|celana|sepatu|tas|sandal|skincare|sabun|odol|sampo/i.test(lower)) {
      return { name: 'Belanja', icon: '🛒', id: 'cat-exp-3' };
    }
    if (/bioskop|xxi|cgv|nonton|film|movie|netflix|spotify|youtube|game|steam|ps5|playstation|diamond|mlbb|genshin|valorant|karaoke|liburan|staycation|piknik|tiket\s*konser/i.test(lower)) {
      return { name: 'Hiburan', icon: '🎮', id: 'cat-exp-4' };
    }
    if (/listrik|pln|token|pdam|air|wifi|indihome|firstmedia|biznet|internet|kuota|paket\s*data|pulsa|bpjs|pbb|iuran|kos|sewa|kontrakan/i.test(lower)) {
      return { name: 'Tagihan & Utilitas', icon: '💡', id: 'cat-exp-5' };
    }
    if (/obat|apotek|dokter|klinik|rs|rumah\s*sakit|vitamin|flu|batuk|dental|gigi|periksa|tes\s*darah|gym|fitness/i.test(lower)) {
      return { name: 'Kesehatan', icon: '💊', id: 'cat-exp-6' };
    }
    if (/buku|kursus|bootcamp|les|spp|ukt|kuliah|sekolah|ujian|skripsi|fotokopi|seminar/i.test(lower)) {
      return { name: 'Pendidikan', icon: '📚', id: 'cat-exp-7' };
    }

    return { name: 'Lainnya', icon: '📦', id: 'cat-exp-8' };
  }

  /**
   * Extract a clean description from the raw text
   */
  extractDescription(text, type, categoryName, amount) {
    let clean = text;

    // Remove price mentions like "harga 5k", "5k", "50rb", "1.5jt", "rp 50.000"
    clean = clean.replace(/\bharga\s*\S+/gi, '');
    clean = clean.replace(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta|k|rb|ribu)\b/gi, '');
    clean = clean.replace(/rp\.?\s*[\d.,]+/gi, '');
    clean = clean.replace(/\b\d{1,3}(?:[.,]\d{3})+\b/g, '');

    // Strip purely conversational fillers: "tadi habis", "baru beli", "dapet transferan", etc.
    clean = clean.replace(/^(tadi\s*habis|tadi\s*abis|baru\s*aja|baru\s*beli|tadi\s*beli|abis\s*bayar|habis\s*bayar|dapat\s*transferan|dapet\s*transferan|dapet\s*transfer|dapat\s*transfer)\s+/i, '');
    clean = clean.replace(/\s+/g, ' ').trim();

    // Capitalize first letter
    if (clean.length > 1) {
      let result = clean.charAt(0).toUpperCase() + clean.slice(1);
      if (/^bulan\s*ini$/i.test(result) && categoryName === 'Gaji') {
        return 'Gaji Bulan Ini';
      }
      return result;
    }

    // Fallbacks
    if (type === 'income') {
      return categoryName === 'Gaji' ? 'Gaji Bulanan' : `Pemasukan (${categoryName})`;
    }
    return `Pengeluaran ${categoryName}`;
  }

  /**
   * Offline Rule-Based Regex Parser (PRD Tier 5 & Emergency Fallback)
   */
  parseOfflineRegex(rawText) {
    const text = (rawText || '').trim();
    if (!text) {
      return {
        success: false,
        error: 'Teks masukan tidak boleh kosong.'
      };
    }

    // Check if input is only a number/amount without context (ambiguous input)
    const isOnlyAmount = /^(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta)?|rp\.?\s*[\d.,]+)$/i.test(text.replace(/\s+/g, ''));

    const amount = this.parseAmount(text);
    if (!amount) {
      return {
        success: false,
        error: 'Nominal tidak dapat dideteksi. Sertakan angka seperti "5k", "25rb", atau "1.5jt".'
      };
    }

    const type = this.determineType(text);
    const category = this.detectCategory(text, type);
    const description = this.extractDescription(text, type, category.name, amount);

    let confidence = 0.95;
    let needsClarification = false;
    let clarificationQuestion = null;

    if (isOnlyAmount) {
      confidence = 0.50;
      needsClarification = true;
      clarificationQuestion = `Untuk apa ${type === 'income' ? 'pemasukan' : 'pengeluaran'} ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)} ini?`;
    } else if (category.name === 'Lainnya') {
      confidence = 0.78;
    }

    const today = new Date().toISOString().split('T')[0];

    return {
      success: true,
      parsed_by: 'local_regex',
      model_badge: '⚡ Local Regex (Offline Draft)',
      data: {
        type,
        amount,
        description,
        category_id: category.id,
        category_name: category.name,
        category_icon: category.icon,
        transaction_date: today,
        confidence,
        raw_input: text,
        needs_clarification: needsClarification,
        clarification_question: clarificationQuestion,
        parsed_by: 'local_regex'
      }
    };
  }

  formatModelBadge(modelName) {
    if (!modelName || modelName === 'local_regex') return '⚡ Local Regex (Offline)';
    if (modelName.includes('flash-lite')) return '🤖 Gemini Flash-Lite';
    if (modelName.includes('3.8-flash')) return '🤖 Gemini 3.8 Flash';
    if (modelName.includes('3.5-flash')) return '🤖 Gemini 3.5 Flash';
    if (modelName.includes('flash')) return '🤖 Gemini Flash';
    return `🤖 Gemini (${modelName.replace('models/', '')})`;
  }

  matchCategoryToStore(catName, type) {
    const cats = (this.categories && this.categories.length)
      ? this.categories.filter(c => c.type === type)
      : [];

    if (!cats.length) {
      return { id: `cat-${type}-def`, name: catName || 'Lainnya', icon: '📦' };
    }

    const target = (catName || '').toLowerCase();
    const exact = cats.find(c => c.name.toLowerCase() === target);
    if (exact) return exact;

    const partial = cats.find(c => target.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(target));
    if (partial) return partial;

    const fallback = cats.find(c => c.name.toLowerCase() === 'lainnya') || cats[0];
    return fallback;
  }

  /**
   * Direct browser call to Google Generative Language API
   */
  async callGeminiDirect(model, text, apiKey, timeoutMs = 5000) {
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${prompt}\n\nTeks transaksi dari pengguna: "${text}"` }]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        })
      });

      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty AI response');
      return JSON.parse(rawText);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Call server endpoint /api/parse as secondary bridge
   */
  async callServerApiParse(text, apiKey) {
    const parseUrl = (window.store && typeof window.store.apiUrl === 'function') 
      ? window.store.apiUrl('/api/parse') 
      : '/api/parse';
    const res = await fetch(parseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, apiKey })
    });
    if (!res.ok) throw new Error(`Server /api/parse error ${res.status}`);
    const json = await res.json();
    return json;
  }

  /**
   * Main parse function (Adaptive Fallback Cascade)
   * Tier 1: Gemini Flash-Lite (Low token, ultra fast)
   * Tier 2: Gemini 3.5 Flash-Lite
   * Tier 3: Gemini Flash Latest
   * Tier 4: Gemini 3.5 / 3.8 Flash
   * Tier 5: Local Regex Rule Engine (Emergency / Offline)
   */
  async parse(rawText, providedApiKey = null) {
    const text = (rawText || '').trim();
    if (!text) {
      return { success: false, error: 'Teks masukan tidak boleh kosong.' };
    }

    // Check offline mode setting
    const isOffline = window.store && window.store.getSettings && window.store.getSettings().isOfflineMode;
    if (isOffline) {
      console.log('📶 [AIParser] App is in Offline Mode. Using Local Regex Parser.');
      return this.parseOfflineRegex(text);
    }

    const apiKey = providedApiKey || (window.store && window.store.getGeminiApiKey ? window.store.getGeminiApiKey() : null);

    // If user provided a personal API key, try direct client cascade first
    if (apiKey) {
      const cascadeModels = [
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-3.8-flash'
      ];

      // Try Direct Browser Calls in Cascade
      for (const model of cascadeModels) {
        try {
          const rawAiData = await this.callGeminiDirect(model, text, apiKey);
          if (rawAiData && rawAiData.amount) {
            const type = (rawAiData.type === 'income') ? 'income' : 'expense';
            const matchedCategory = this.matchCategoryToStore(rawAiData.category_name, type);
            const today = new Date().toISOString().split('T')[0];

            return {
              success: true,
              parsed_by: model,
              model_badge: this.formatModelBadge(model),
              data: {
                type,
                amount: Number(rawAiData.amount),
                description: rawAiData.description || 'Transaksi',
                category_id: matchedCategory.id,
                category_name: matchedCategory.name,
                category_icon: rawAiData.category_icon || matchedCategory.icon || '📦',
                transaction_date: today,
                confidence: rawAiData.confidence || 0.96,
                raw_input: text,
                needs_clarification: !!rawAiData.needs_clarification,
                clarification_question: rawAiData.clarification_question || null,
                parsed_by: model
              }
            };
          }
        } catch (err) {
          console.warn(`[AIParser Cascade] Direct call to ${model} failed (${err.message}). Trying next tier...`);
        }
      }
    }

    // Try Server API bridge fallback
    try {
      const serverRes = await this.callServerApiParse(text, apiKey);
      if (serverRes.success && serverRes.data) {
        const sData = serverRes.data;
        const type = (sData.type === 'income') ? 'income' : 'expense';
        const matchedCategory = this.matchCategoryToStore(sData.category_name, type);
        const today = new Date().toISOString().split('T')[0];

        return {
          success: true,
          parsed_by: serverRes.parsed_by || 'gemini-server',
          model_badge: this.formatModelBadge(serverRes.parsed_by),
          data: {
            type,
            amount: Number(sData.amount),
            description: sData.description || 'Transaksi',
            category_id: matchedCategory.id,
            category_name: matchedCategory.name,
            category_icon: sData.category_icon || matchedCategory.icon || '📦',
            transaction_date: today,
            confidence: sData.confidence || 0.95,
            raw_input: text,
            needs_clarification: !!sData.needs_clarification,
            clarification_question: sData.clarification_question || null,
            parsed_by: serverRes.parsed_by || 'gemini-server'
          }
        };
      }
    } catch (serverErr) {
      console.warn(`[AIParser Cascade] Server bridge failed (${serverErr.message}).`);
    }

    // Final Fallback: Local Regex
    console.info('⚡ [AIParser] All AI cascade tiers exhausted. Falling back to Local Regex Rule Engine.');
    return this.parseOfflineRegex(text);
  }
}

// Export for browser
window.AIParser = AIParser;

