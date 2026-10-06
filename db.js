/**
 * CatatDuit - Database Adapter
 * Supports Vercel Postgres (Neon) via POSTGRES_URL / DATABASE_URL with SSL
 * Includes automatic schema migrations and graceful local fallback.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { Pool } = require('pg');

const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const DEFAULT_USER = {
  id: 'usr-azriel-default',
  email: 'azriel@example.com',
  name: 'Azriel'
};

const DEFAULT_CATEGORIES = [
  // Expense Categories
  { id: 'cat-exp-1', name: 'Makanan & Minuman', type: 'expense', icon: '🍔', color: '#F59E0B', is_default: true },
  { id: 'cat-exp-2', name: 'Transportasi', type: 'expense', icon: '🚗', color: '#3B82F6', is_default: true },
  { id: 'cat-exp-3', name: 'Belanja', type: 'expense', icon: '🛒', color: '#EC4899', is_default: true },
  { id: 'cat-exp-4', name: 'Hiburan', type: 'expense', icon: '🎮', color: '#8B5CF6', is_default: true },
  { id: 'cat-exp-5', name: 'Tagihan & Utilitas', type: 'expense', icon: '💡', color: '#EAB308', is_default: true },
  { id: 'cat-exp-6', name: 'Kesehatan', type: 'expense', icon: '💊', color: '#EF4444', is_default: true },
  { id: 'cat-exp-7', name: 'Pendidikan', type: 'expense', icon: '📚', color: '#06B6D4', is_default: true },
  { id: 'cat-exp-8', name: 'Lainnya', type: 'expense', icon: '📦', color: '#6B7280', is_default: true },

  // Income Categories
  { id: 'cat-inc-1', name: 'Gaji', type: 'income', icon: '💰', color: '#10B981', is_default: true },
  { id: 'cat-inc-2', name: 'Freelance', type: 'income', icon: '💻', color: '#3B82F6', is_default: true },
  { id: 'cat-inc-3', name: 'Investasi', type: 'income', icon: '📈', color: '#8B5CF6', is_default: true },
  { id: 'cat-inc-4', name: 'Hadiah', type: 'income', icon: '🎁', color: '#F43F5E', is_default: true },
  { id: 'cat-inc-5', name: 'Lainnya', type: 'income', icon: '📦', color: '#6B7280', is_default: true }
];

// Determine connection string for Vercel Postgres / Neon / PostgreSQL
const connectionString = 
  process.env.POSTGRES_URL || 
  process.env.DATABASE_URL || 
  process.env.STORAGE_URL || 
  process.env.POSTGRES_PRISMA_URL || 
  process.env.STORAGE_PRISMA_URL || 
  process.env.POSTGRES_URL_NON_POOLING;

let pool = null;
let usePostgres = false;
let initPromise = null;

// Local fallback store setup (Safe for Vercel Read-Only Filesystem)
const LOCAL_DATA_DIR = isVercel ? os.tmpdir() : path.join(__dirname, 'data');
const LOCAL_DB_FILE = path.join(LOCAL_DATA_DIR, 'catatduit-local-db.json');

let inMemoryStore = null;

function getLocalStore() {
  if (inMemoryStore) return inMemoryStore;

  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(LOCAL_DB_FILE)) {
      const data = fs.readFileSync(LOCAL_DB_FILE, 'utf8');
      inMemoryStore = JSON.parse(data);
      return inMemoryStore;
    }
  } catch (err) {
    console.warn('[Local Store] Read error, creating fresh store:', err.message);
  }

  const initial = {
    users: [DEFAULT_USER],
    categories: [...DEFAULT_CATEGORIES],
    transactions: [],
    monthly_summaries: {}
  };
  inMemoryStore = initial;
  saveLocalStore(initial);
  return initial;
}

function saveLocalStore(data) {
  inMemoryStore = data;
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // Non-fatal warning if running on read-only lambda filesystem
    console.warn('[Local Store] Storage save notice:', err.message);
  }
}

/**
 * Initialize PostgreSQL connection or activate local fallback
 */
async function initDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (connectionString) {
      try {
        console.log('[Database] Connecting to Vercel Postgres / Neon...');
        const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
        
        pool = new Pool({
          connectionString,
          ssl: isLocalhost ? false : { rejectUnauthorized: false },
          max: isVercel ? 2 : 10,
          idleTimeoutMillis: isVercel ? 10000 : 30000,
          connectionTimeoutMillis: 8000
        });

        // Test connection with timeout
        const client = await pool.connect();
        const testRes = await client.query('SELECT NOW() as current_time, version() as pg_version');
        client.release();
        
        console.log(`[Database] Connected successfully to PostgreSQL (${testRes.rows[0].current_time})`);
        usePostgres = true;

        // Auto-run schema migrations
        await runMigrations();
        await seedDefaults();
        return { success: true, engine: 'vercel-postgres' };
      } catch (err) {
        console.warn(`[Database] PostgreSQL connection failed (${err.message}). Activating local fallback engine.`);
        usePostgres = false;
        pool = null;
      }
    } else {
      console.log('[Database] No POSTGRES_URL or DATABASE_URL found. Running with local fallback engine.');
      usePostgres = false;
    }

    // Initialize local store
    getLocalStore();
    return { success: true, engine: 'local-store' };
  })();

  return initPromise;
}

/**
 * Execute DDL migrations for Vercel Postgres
 */
async function runMigrations() {
  if (!usePostgres || !pool) return;

  const migrationQueries = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(100) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
      icon VARCHAR(20),
      color VARCHAR(20),
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(100) PRIMARY KEY,
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
    );`,

    `CREATE TABLE IF NOT EXISTS monthly_summaries (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
      year_month VARCHAR(7) NOT NULL,
      total_income DECIMAL(15, 2) DEFAULT 0,
      total_expense DECIMAL(15, 2) DEFAULT 0,
      balance DECIMAL(15, 2) DEFAULT 0,
      category_breakdown JSONB DEFAULT '{}',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, year_month)
    );`,

    `CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_sync ON transactions(sync_status) WHERE sync_status != 'synced';`
  ];

  for (const q of migrationQueries) {
    try {
      await pool.query(q);
    } catch (err) {
      console.error('[Database Migration Error]:', err.message, '\nQuery:', q);
    }
  }
}

/**
 * Seed default user and initial categories
 */
async function seedDefaults() {
  if (!usePostgres || !pool) return;

  try {
    // 1. Ensure default user exists
    await pool.query(
      `INSERT INTO users (id, email, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;`,
      [DEFAULT_USER.id, DEFAULT_USER.email, DEFAULT_USER.name]
    );

    // 2. Check if categories exist
    const catCheck = await pool.query('SELECT COUNT(*) FROM categories WHERE user_id = $1 OR is_default = true', [DEFAULT_USER.id]);
    if (parseInt(catCheck.rows[0].count, 10) === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await pool.query(
          `INSERT INTO categories (id, user_id, name, type, icon, color, is_default)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING;`,
          [cat.id, DEFAULT_USER.id, cat.name, cat.type, cat.icon, cat.color, cat.is_default]
        );
      }
      console.log(`[Database] Seeded ${DEFAULT_CATEGORIES.length} default categories.`);
    }
  } catch (err) {
    console.error('[Database Seed Error]:', err.message);
  }
}

/**
 * Health check & database status
 */
async function getDbStatus() {
  await initDatabase();

  if (usePostgres && pool) {
    try {
      const ping = await pool.query('SELECT NOW() as now, current_database() as db_name');
      const userCount = await pool.query('SELECT COUNT(*) FROM users');
      const catCount = await pool.query('SELECT COUNT(*) FROM categories');
      const txCount = await pool.query('SELECT COUNT(*) FROM transactions');

      return {
        connected: true,
        isCloudDb: true,
        provider: 'vercel-postgres',
        engine: 'PostgreSQL (Neon / Vercel Postgres)',
        database: ping.rows[0].db_name,
        serverTime: ping.rows[0].now,
        ssl: true,
        stats: {
          users: parseInt(userCount.rows[0].count, 10),
          categories: parseInt(catCount.rows[0].count, 10),
          transactions: parseInt(txCount.rows[0].count, 10)
        },
        message: 'Terhubung ke Vercel Postgres Database dengan SSL aman.'
      };
    } catch (err) {
      return {
        connected: false,
        isCloudDb: false,
        provider: 'vercel-postgres',
        error: err.message,
        message: 'Koneksi PostgreSQL terputus.'
      };
    }
  }

  const store = getLocalStore();
  return {
    connected: false,
    isCloudDb: false,
    provider: 'local-fallback',
    engine: 'CatatDuit Local JSON / Memory Store',
    stats: {
      users: store.users.length,
      categories: store.categories.length,
      transactions: store.transactions.length
    },
    message: 'Perhatian: Berjalan dalam mode lokal offline. Untuk menghubungkan ke Vercel Postgres, isi POSTGRES_URL di .env atau dashboard Vercel.'
  };
}

/**
 * Categories operations
 */
async function getCategories(userId = DEFAULT_USER.id) {
  await initDatabase();

  if (usePostgres && pool) {
    const res = await pool.query(
      `SELECT id, name, type, icon, color, is_default
       FROM categories
       WHERE user_id = $1 OR is_default = true
       ORDER BY is_default DESC, created_at ASC`,
      [userId]
    );
    return res.rows;
  }

  const store = getLocalStore();
  return store.categories;
}

async function addCategory(category, userId = DEFAULT_USER.id) {
  await initDatabase();

  const newCat = {
    id: category.id || `cat-custom-${Date.now()}`,
    user_id: userId,
    name: category.name,
    type: category.type,
    icon: category.icon || '🏷️',
    color: category.color || '#3B82F6',
    is_default: false
  };

  if (usePostgres && pool) {
    await pool.query(
      `INSERT INTO categories (id, user_id, name, type, icon, color, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newCat.id, newCat.user_id, newCat.name, newCat.type, newCat.icon, newCat.color, newCat.is_default]
    );
    return newCat;
  }

  const store = getLocalStore();
  store.categories.push(newCat);
  saveLocalStore(store);
  return newCat;
}

async function deleteCategory(id, userId = DEFAULT_USER.id) {
  await initDatabase();

  if (usePostgres && pool) {
    // 1. Get target category
    const catRes = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (catRes.rows.length === 0) {
      return { success: false, message: 'Kategori tidak ditemukan.' };
    }
    const targetCat = catRes.rows[0];

    if (targetCat.name.toLowerCase() === 'lainnya') {
      return { success: false, message: 'Kategori "Lainnya" adalah kategori sistem dan tidak dapat dihapus.' };
    }

    // 2. Find or create fallback category 'Lainnya' of matching type
    const fallbackId = targetCat.type === 'income' ? 'cat-inc-5' : 'cat-exp-8';
    const fbRes = await pool.query('SELECT * FROM categories WHERE id = $1', [fallbackId]);
    let fallbackCat = fbRes.rows[0];
    if (!fallbackCat) {
      const fbSearch = await pool.query('SELECT * FROM categories WHERE type = $1 AND LOWER(name) = $2 LIMIT 1', [targetCat.type, 'lainnya']);
      fallbackCat = fbSearch.rows[0];
    }

    const fallbackCatId = fallbackCat ? fallbackCat.id : null;
    const fallbackCatName = fallbackCat ? fallbackCat.name : 'Lainnya';
    const fallbackCatIcon = fallbackCat ? fallbackCat.icon : '📦';

    // 3. Reassign transactions to fallback category
    const reassignRes = await pool.query(
      `UPDATE transactions
       SET category_id = $1, category_name = $2, category_icon = $3, updated_at = NOW()
       WHERE user_id = $4 AND (category_id = $5 OR category_name = $6)`,
      [fallbackCatId, fallbackCatName, fallbackCatIcon, userId, id, targetCat.name]
    );

    // 4. Delete category
    await pool.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);

    return {
      success: true,
      categoryName: targetCat.name,
      reassignedCount: reassignRes.rowCount || 0,
      fallbackName: fallbackCatName
    };
  }

  // Local fallback
  const store = getLocalStore();
  const targetIdx = store.categories.findIndex(c => c.id === id);
  if (targetIdx === -1) {
    return { success: false, message: 'Kategori tidak ditemukan.' };
  }
  const targetCat = store.categories[targetIdx];
  if (targetCat.name.toLowerCase() === 'lainnya') {
    return { success: false, message: 'Kategori "Lainnya" adalah kategori sistem dan tidak dapat dihapus.' };
  }

  let fallbackCat = store.categories.find(c => c.type === targetCat.type && c.name.toLowerCase() === 'lainnya');
  if (!fallbackCat) {
    fallbackCat = {
      id: targetCat.type === 'income' ? 'cat-inc-5' : 'cat-exp-8',
      name: 'Lainnya',
      type: targetCat.type,
      icon: '📦',
      color: '#6B7280',
      is_default: true
    };
    store.categories.push(fallbackCat);
  }

  let reassignedCount = 0;
  store.transactions.forEach(t => {
    if (t.category_id === id || t.category_name === targetCat.name) {
      t.category_id = fallbackCat.id;
      t.category_name = fallbackCat.name;
      t.category_icon = fallbackCat.icon;
      reassignedCount++;
    }
  });

  store.categories.splice(targetIdx, 1);
  saveLocalStore(store);

  return {
    success: true,
    categoryName: targetCat.name,
    reassignedCount,
    fallbackName: fallbackCat.name
  };
}

/**
 * Transactions operations
 */
async function getTransactions(options = {}) {
  await initDatabase();
  const {
    userId = DEFAULT_USER.id,
    limit = 100,
    offset = 0,
    type = null,
    month = null,
    search = null
  } = options;

  if (usePostgres && pool) {
    const conditions = ['user_id = $1'];
    const params = [userId];
    let pIdx = 2;

    if (type) {
      conditions.push(`type = $${pIdx++}`);
      params.push(type);
    }
    if (month) {
      conditions.push(`TO_CHAR(transaction_date, 'YYYY-MM') = $${pIdx++}`);
      params.push(month);
    }
    if (search) {
      conditions.push(`(description ILIKE $${pIdx} OR category_name ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT id, user_id, amount, type, category_id, category_name, category_icon,
             description, raw_input, ai_confidence, 
             TO_CHAR(transaction_date, 'YYYY-MM-DD') as transaction_date,
             transaction_time, device_id, version, sync_status, created_at, updated_at
      FROM transactions
      ${whereClause}
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;
    params.push(limit, offset);

    const countSql = `SELECT COUNT(*) FROM transactions ${whereClause}`;
    const [dataRes, countRes] = await Promise.all([
      pool.query(sql, params),
      pool.query(countSql, params.slice(0, pIdx - 3))
    ]);

    return {
      transactions: dataRes.rows.map(r => ({ ...r, amount: Number(r.amount) })),
      total: parseInt(countRes.rows[0].count, 10),
      limit,
      offset
    };
  }

  // Local fallback
  const store = getLocalStore();
  let txs = [...store.transactions];

  if (type) txs = txs.filter(t => t.type === type);
  if (month) txs = txs.filter(t => (t.transaction_date || '').startsWith(month));
  if (search) {
    const s = search.toLowerCase();
    txs = txs.filter(t => 
      (t.description || '').toLowerCase().includes(s) || 
      (t.category_name || '').toLowerCase().includes(s)
    );
  }

  // Sort descending by date & creation
  txs.sort((a, b) => new Date(b.transaction_date || b.created_at) - new Date(a.transaction_date || a.created_at));

  const total = txs.length;
  const paged = txs.slice(offset, offset + limit);

  return {
    transactions: paged,
    total,
    limit,
    offset
  };
}

async function createTransaction(txData, userId = DEFAULT_USER.id) {
  await initDatabase();

  const id = txData.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const amount = Number(txData.amount) || 0;
  const type = txData.type === 'income' ? 'income' : 'expense';
  const category_id = txData.category_id || null;
  const category_name = txData.category_name || 'Lainnya';
  const category_icon = txData.category_icon || '📦';
  const description = txData.description || 'Transaksi';
  const raw_input = txData.raw_input || '';
  const ai_confidence = txData.ai_confidence !== undefined ? Number(txData.ai_confidence) : 0.95;
  const transaction_date = txData.transaction_date || new Date().toISOString().split('T')[0];
  const transaction_time = txData.transaction_time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  const sync_status = 'synced';
  const created_at = txData.created_at || new Date().toISOString();

  if (usePostgres && pool) {
    const sql = `
      INSERT INTO transactions (
        id, user_id, amount, type, category_id, category_name, category_icon,
        description, raw_input, ai_confidence, transaction_date, transaction_time,
        device_id, version, sync_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, $14, $15, NOW())
      ON CONFLICT (id) DO UPDATE SET
        amount = EXCLUDED.amount,
        type = EXCLUDED.type,
        category_id = EXCLUDED.category_id,
        category_name = EXCLUDED.category_name,
        category_icon = EXCLUDED.category_icon,
        description = EXCLUDED.description,
        transaction_date = EXCLUDED.transaction_date,
        transaction_time = EXCLUDED.transaction_time,
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [
      id, userId, amount, type, category_id, category_name, category_icon,
      description, raw_input, ai_confidence, transaction_date, transaction_time,
      txData.device_id || 'web-client', sync_status, created_at
    ];

    const res = await pool.query(sql, values);
    const row = res.rows[0];
    return { ...row, amount: Number(row.amount) };
  }

  // Local fallback
  const store = getLocalStore();
  const newTx = {
    id,
    user_id: userId,
    amount,
    type,
    category_id,
    category_name,
    category_icon,
    description,
    raw_input,
    ai_confidence,
    transaction_date,
    transaction_time,
    device_id: txData.device_id || 'web-client',
    version: 1,
    sync_status,
    created_at,
    updated_at: new Date().toISOString()
  };

  const existingIdx = store.transactions.findIndex(t => t.id === id);
  if (existingIdx !== -1) {
    store.transactions[existingIdx] = newTx;
  } else {
    store.transactions.unshift(newTx);
  }
  saveLocalStore(store);
  return newTx;
}

async function updateTransaction(id, txData, userId = DEFAULT_USER.id) {
  await initDatabase();

  if (usePostgres && pool) {
    const fields = [];
    const values = [id, userId];
    let vIdx = 3;

    if (txData.amount !== undefined) {
      fields.push(`amount = $${vIdx++}`);
      values.push(Number(txData.amount));
    }
    if (txData.type !== undefined) {
      fields.push(`type = $${vIdx++}`);
      values.push(txData.type);
    }
    if (txData.category_id !== undefined) {
      fields.push(`category_id = $${vIdx++}`);
      values.push(txData.category_id);
    }
    if (txData.category_name !== undefined) {
      fields.push(`category_name = $${vIdx++}`);
      values.push(txData.category_name);
    }
    if (txData.category_icon !== undefined) {
      fields.push(`category_icon = $${vIdx++}`);
      values.push(txData.category_icon);
    }
    if (txData.description !== undefined) {
      fields.push(`description = $${vIdx++}`);
      values.push(txData.description);
    }
    if (txData.transaction_date !== undefined) {
      fields.push(`transaction_date = $${vIdx++}`);
      values.push(txData.transaction_date);
    }
    if (txData.transaction_time !== undefined) {
      fields.push(`transaction_time = $${vIdx++}`);
      values.push(txData.transaction_time);
    }

    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');

    const sql = `
      UPDATE transactions
      SET ${fields.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `;

    const res = await pool.query(sql, values);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return { ...row, amount: Number(row.amount) };
  }

  // Local fallback
  const store = getLocalStore();
  const idx = store.transactions.findIndex(t => t.id === id);
  if (idx !== -1) {
    store.transactions[idx] = {
      ...store.transactions[idx],
      ...txData,
      amount: txData.amount !== undefined ? Number(txData.amount) : store.transactions[idx].amount,
      updated_at: new Date().toISOString()
    };
    saveLocalStore(store);
    return store.transactions[idx];
  }
  return null;
}

async function deleteTransaction(id, userId = DEFAULT_USER.id) {
  await initDatabase();

  if (usePostgres && pool) {
    await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
    // Idempotent delete: return true regardless of whether 1 row was deleted or already absent
    return true;
  }

  // Local fallback
  const store = getLocalStore();
  store.transactions = store.transactions.filter(t => t.id !== id);
  saveLocalStore(store);
  return true;
}

/**
 * Batch Sync handler for offline pending queue
 * Accepts array of queue actions: [{ action: 'CREATE'|'UPDATE'|'DELETE', id: '...', data: {...} }]
 * Returns { total, synced, syncedIds, errors } so client can perform partial queue resolution.
 */
async function batchSync(queueItems = [], userId = DEFAULT_USER.id) {
  await initDatabase();
  const results = {
    total: queueItems.length,
    synced: 0,
    syncedIds: [],
    errors: []
  };

  for (const item of queueItems) {
    const itemId = item.id || item.data?.id;
    try {
      if (item.action === 'CREATE') {
        const payload = item.data || {};
        if (itemId && !payload.id) payload.id = itemId;
        if (payload.amount === undefined || payload.amount === null || !payload.type) {
          throw new Error('Nominal dan jenis transaksi wajib diisi.');
        }
        await createTransaction(payload, userId);
        results.synced++;
        if (itemId) results.syncedIds.push(itemId);
      } else if (item.action === 'UPDATE') {
        const payload = item.data || {};
        const updated = await updateTransaction(itemId, payload, userId);
        if (!updated && payload.amount && payload.type) {
          // If record wasn't on server yet, create it idempotently
          await createTransaction({ ...payload, id: itemId }, userId);
        }
        results.synced++;
        if (itemId) results.syncedIds.push(itemId);
      } else if (item.action === 'DELETE') {
        await deleteTransaction(itemId, userId);
        results.synced++;
        if (itemId) results.syncedIds.push(itemId);
      }
    } catch (err) {
      results.errors.push({ id: itemId, error: err.message });
    }
  }

  return results;
}

/**
 * Monthly analytics summary
 */
async function getSummary(userId = DEFAULT_USER.id, yearMonth = null) {
  await initDatabase();

  const ym = yearMonth || new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  if (usePostgres && pool) {
    const sql = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
        COUNT(*) as count
      FROM transactions
      WHERE user_id = $1 AND TO_CHAR(transaction_date, 'YYYY-MM') = $2
    `;
    const catSql = `
      SELECT category_name, category_icon, SUM(amount) as total, COUNT(*) as count
      FROM transactions
      WHERE user_id = $1 AND type = 'expense' AND TO_CHAR(transaction_date, 'YYYY-MM') = $2
      GROUP BY category_name, category_icon
      ORDER BY total DESC
    `;

    const [summaryRes, catRes] = await Promise.all([
      pool.query(sql, [userId, ym]),
      pool.query(catSql, [userId, ym])
    ]);

    const income = Number(summaryRes.rows[0].total_income);
    const expense = Number(summaryRes.rows[0].total_expense);
    const balance = income - expense;

    return {
      yearMonth: ym,
      income,
      expense,
      balance,
      transactionCount: parseInt(summaryRes.rows[0].count, 10),
      categoryBreakdown: catRes.rows.map(r => ({
        name: r.category_name,
        icon: r.category_icon || '📦',
        total: Number(r.total),
        count: parseInt(r.count, 10)
      }))
    };
  }

  // Local fallback
  const store = getLocalStore();
  const txs = store.transactions.filter(t => (t.transaction_date || '').startsWith(ym));

  let income = 0;
  let expense = 0;
  const catMap = {};

  txs.forEach(t => {
    const amt = Number(t.amount);
    if (t.type === 'income') {
      income += amt;
    } else {
      expense += amt;
      const cat = t.category_name || 'Lainnya';
      if (!catMap[cat]) {
        catMap[cat] = { name: cat, icon: t.category_icon || '📦', total: 0, count: 0 };
      }
      catMap[cat].total += amt;
      catMap[cat].count += 1;
    }
  });

  return {
    yearMonth: ym,
    income,
    expense,
    balance: income - expense,
    transactionCount: txs.length,
    categoryBreakdown: Object.values(catMap).sort((a, b) => b.total - a.total)
  };
}

module.exports = {
  initDatabase,
  getDbStatus,
  getCategories,
  addCategory,
  deleteCategory,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  batchSync,
  getSummary,
  DEFAULT_USER,
  DEFAULT_CATEGORIES
};
