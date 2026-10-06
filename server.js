const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const db = require('./db');
const { handlers, MODEL_CASCADE } = require('./api-handlers');

function getNetworkIp() {
  const ifaces = os.networkInterfaces();
  for (const name in ifaces) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Load environment variables from .env if present
const BASE_DIR = __dirname;
const envPath = path.join(BASE_DIR, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
const DEFAULT_GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp'
};

function readBodyJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/**
 * Handle incoming API requests
 */
async function handleApiRequest(req, res, parsedUrl) {
  const reqPath = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Common CORS and JSON headers
  const setCors = () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  };

  setCors();

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  const query = {};
  parsedUrl.searchParams.forEach((val, key) => {
    query[key] = val;
  });

  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(JSON.stringify(data));
  };

  try {
    // 1. GET /api/config
    if (reqPath === '/api/config' && method === 'GET') {
      const networkIp = getNetworkIp();
      const dbStatus = await db.getDbStatus();
      sendJson(200, {
        status: 'ok',
        hasGeminiKey: !!DEFAULT_GEMINI_API_KEY,
        networkIp: networkIp,
        port: PORT,
        mobileUrl: `http://${networkIp}:${PORT}`,
        models: MODEL_CASCADE,
        database: {
          connected: dbStatus.connected,
          provider: dbStatus.provider,
          engine: dbStatus.engine
        }
      });
      return true;
    }

    // 2. GET /api/db-status
    if (reqPath === '/api/db-status' && method === 'GET') {
      const resp = await handlers.getDbStatus(req, res);
      sendJson(resp.status, resp.body);
      return true;
    }

    // 3. /api/categories
    if (reqPath === '/api/categories') {
      if (method === 'GET') {
        const resp = await handlers.getCategories();
        sendJson(resp.status, resp.body);
        return true;
      }
      if (method === 'POST') {
        const body = await readBodyJson(req);
        const resp = await handlers.addCategory(body);
        sendJson(resp.status, resp.body);
        return true;
      }
      if (method === 'DELETE') {
        const id = query.id;
        const resp = await handlers.deleteCategory(id);
        sendJson(resp.status, resp.body);
        return true;
      }
    }

    // Matches /api/categories/:id
    const catMatch = reqPath.match(/^\/api\/categories\/([^/]+)$/);
    if (catMatch && method === 'DELETE') {
      const catId = decodeURIComponent(catMatch[1]);
      const resp = await handlers.deleteCategory(catId);
      sendJson(resp.status, resp.body);
      return true;
    }

    // 4. /api/transactions
    if (reqPath === '/api/transactions') {
      if (method === 'GET') {
        const resp = await handlers.getTransactions(query);
        sendJson(resp.status, resp.body);
        return true;
      }
      if (method === 'POST') {
        const body = await readBodyJson(req);
        const resp = await handlers.createTransaction(body);
        sendJson(resp.status, resp.body);
        return true;
      }
      if (method === 'PUT') {
        const id = query.id;
        const body = await readBodyJson(req);
        const resp = await handlers.updateTransaction(id, body);
        sendJson(resp.status, resp.body);
        return true;
      }
      if (method === 'DELETE') {
        const id = query.id;
        const resp = await handlers.deleteTransaction(id);
        sendJson(resp.status, resp.body);
        return true;
      }
    }

    // Matches /api/transactions/:id
    const txMatch = reqPath.match(/^\/api\/transactions\/([^/]+)$/);
    if (txMatch) {
      const txId = decodeURIComponent(txMatch[1]);
      if (method === 'PUT') {
        const body = await readBodyJson(req);
        const resp = await handlers.updateTransaction(txId, body);
        sendJson(resp.status, resp.body);
        return true;
      }
      if (method === 'DELETE') {
        const resp = await handlers.deleteTransaction(txId);
        sendJson(resp.status, resp.body);
        return true;
      }
    }

    // 5. POST /api/sync
    if (reqPath === '/api/sync' && method === 'POST') {
      const body = await readBodyJson(req);
      const resp = await handlers.syncTransactions(body);
      sendJson(resp.status, resp.body);
      return true;
    }

    // 6. GET /api/summary
    if (reqPath === '/api/summary' && method === 'GET') {
      const resp = await handlers.getSummary(query);
      sendJson(resp.status, resp.body);
      return true;
    }

    // 7. POST /api/parse
    if (reqPath === '/api/parse' && method === 'POST') {
      const body = await readBodyJson(req);
      const resp = await handlers.parseTransaction(body, DEFAULT_GEMINI_API_KEY);
      sendJson(resp.status, resp.body);
      return true;
    }

    // 8. /api/test-gemini
    if (reqPath === '/api/test-gemini' && (method === 'POST' || method === 'GET')) {
      const body = method === 'POST' ? await readBodyJson(req) : {};
      const resp = await handlers.testGemini(body, DEFAULT_GEMINI_API_KEY);
      sendJson(resp.status, resp.body);
      return true;
    }

    // Not found API route
    sendJson(404, { success: false, error: `Endpoint ${method} ${reqPath} tidak ditemukan.` });
    return true;
  } catch (err) {
    console.error(`[API Error] ${method} ${reqPath}:`, err);
    sendJson(500, { success: false, error: err.message || 'Internal Server Error' });
    return true;
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let reqPath = decodeURI(parsedUrl.pathname);

  // Check if API endpoint
  if (reqPath.startsWith('/api/')) {
    const handled = await handleApiRequest(req, res, parsedUrl);
    if (handled) return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(BASE_DIR, reqPath);

  // Security: prevent path traversal outside root
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA if not found and has no extension
      if (!path.extname(reqPath)) {
        const indexPath = path.join(BASE_DIR, 'index.html');
        fs.readFile(indexPath, (readErr, content) => {
          if (readErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(content);
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// Auto-initialize DB and listen
db.initDatabase().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    const networkIp = getNetworkIp();
    console.log(`\n======================================================`);
    console.log(`  CatatDuit Backend & Fullstack Web App Running!`);
    console.log(`  > Local:       http://localhost:${PORT}`);
    console.log(`  > Wi-Fi/HP:    http://${networkIp}:${PORT}`);
    console.log(`  > DB Status:   http://localhost:${PORT}/api/db-status`);
    console.log(`  Gemini Key:    ${DEFAULT_GEMINI_API_KEY ? DEFAULT_GEMINI_API_KEY.slice(0, 6) + '...' + DEFAULT_GEMINI_API_KEY.slice(-4) + ' (Configured)' : '[Not set in .env]'}`);
    console.log(`======================================================\n`);
  });
}).catch(err => {
  console.error('[Startup Error]:', err);
});
