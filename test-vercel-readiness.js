/**
 * Automated Verification for Vercel Serverless & Production Readiness
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// Auto-load .env for simulation
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

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; }
  };
}

async function runAudit() {
  console.log('====================================================');
  console.log('  Vercel & GitHub Deployment Readiness Audit');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${name} ${details}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${details}`);
      failed++;
    }
  }

  // 1. Check .gitignore
  console.log('[1] Checking .gitignore configuration...');
  const gitignorePath = path.join(__dirname, '.gitignore');
  assert(fs.existsSync(gitignorePath), '.gitignore file exists');
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  assert(gitignoreContent.includes('.env'), '.gitignore protects .env');
  assert(gitignoreContent.includes('node_modules'), '.gitignore protects node_modules');
  assert(gitignoreContent.includes('data'), '.gitignore protects local data store');

  // 2. Check no secret leakage in /api/config
  console.log('\n[2] Checking /api/config security (No API Key Leak)...');
  const configHandler = require('./api/config');
  const res1 = mockRes();
  await configHandler({ method: 'GET' }, res1);
  assert(res1.statusCode === 200, '/api/config returns 200');
  assert(res1.body.hasGeminiKey === true, '/api/config reports hasGeminiKey correctly');
  assert(res1.body.defaultApiKey === undefined, '/api/config DOES NOT expose defaultApiKey (Zero Leak)');

  // 3. Check Vercel rewrites in vercel.json
  console.log('\n[3] Checking vercel.json rewrites & functions config...');
  const vercelJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8'));
  assert(Array.isArray(vercelJson.rewrites), 'vercel.json has rewrites array');
  const hasTxRewrite = vercelJson.rewrites.some(r => r.source.includes('transactions/:id'));
  const hasCatRewrite = vercelJson.rewrites.some(r => r.source.includes('categories/:id'));
  assert(hasTxRewrite, 'Rewrite for /api/transactions/:id configured');
  assert(hasCatRewrite, 'Rewrite for /api/categories/:id configured');
  assert(vercelJson.functions?.['api/*.js']?.maxDuration >= 30, 'Vercel maxDuration configured for AI latency');

  // 4. Check dynamic route handlers
  console.log('\n[4] Checking Vercel dynamic route handlers...');
  const txIdHandler = require('./api/transactions/[id]');
  const catIdHandler = require('./api/categories/[id]');
  assert(typeof txIdHandler === 'function', 'api/transactions/[id].js exports function');
  assert(typeof catIdHandler === 'function', 'api/categories/[id].js exports function');

  // 5. Test Transaction Lifecycle through Serverless Handler
  console.log('\n[5] Testing /api/transactions serverless handler...');
  const txHandler = require('./api/transactions');
  
  // POST
  const postRes = mockRes();
  await txHandler({
    method: 'POST',
    body: {
      amount: 35000,
      type: 'expense',
      category_name: 'Makanan & Minuman',
      category_icon: '🍔',
      description: 'Nasi Goreng Spesial',
      transaction_date: '2026-10-05'
    }
  }, postRes);
  assert(postRes.statusCode === 201, 'POST /api/transactions creates transaction (201)');
  const newTxId = postRes.body?.transaction?.id;
  assert(!!newTxId, 'Transaction received unique ID', `(${newTxId})`);

  // PUT with query param (simulating Vercel rewrite or [id].js)
  const putRes = mockRes();
  await txHandler({
    method: 'PUT',
    query: { id: newTxId },
    body: {
      amount: 40000,
      description: 'Nasi Goreng Spesial + Es Teh'
    }
  }, putRes);
  assert(putRes.statusCode === 200, 'PUT /api/transactions/:id updates transaction (200)');
  assert(Number(putRes.body?.transaction?.amount) === 40000, 'Updated amount is 40000');

  // DELETE with query param
  const delRes = mockRes();
  await txHandler({
    method: 'DELETE',
    query: { id: newTxId }
  }, delRes);
  assert(delRes.statusCode === 200, 'DELETE /api/transactions/:id deletes transaction (200)');

  // 6. Test /api/parse serverless function
  console.log('\n[6] Testing /api/parse serverless bridge...');
  const parseHandler = require('./api/parse');
  const parseRes = mockRes();
  await parseHandler({
    method: 'POST',
    body: { text: 'makan siang padang 25rb' }
  }, parseRes);
  assert(parseRes.statusCode === 200, '/api/parse returns 200 using server environment key');
  assert(parseRes.body?.data?.amount === 25000, 'Parsed amount is 25000');
  assert(parseRes.body?.data?.type === 'expense', 'Parsed type is expense');

  // 7. Check serverless read-only filesystem resilience
  console.log('\n[7] Simulating Vercel Serverless environment (isVercel = true)...');
  process.env.VERCEL = '1';
  const db = require('./db');
  const dbStatus = await db.getDbStatus();
  assert(dbStatus.connected === true, 'Database status connected under Vercel simulation');

  console.log('\n====================================================');
  console.log(`  Readiness Audit Result: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
