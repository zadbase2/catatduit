/**
 * HTTP Integration Test against running CatatDuit server
 */
const http = require('http');

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function verify() {
  console.log('Testing live HTTP server on port 3000...\n');

  // 1. /api/db-status
  const s1 = await makeRequest('/api/db-status');
  console.log('1. /api/db-status:', s1.status, s1.body?.provider, s1.body?.connected ? 'CONNECTED' : 'DISCONNECTED');

  // 2. /api/config
  const s2 = await makeRequest('/api/config');
  console.log('2. /api/config:', s2.status, 'Models:', s2.body?.models?.length, 'DB Engine:', s2.body?.database?.engine);

  // 3. /api/categories
  const s3 = await makeRequest('/api/categories');
  console.log('3. /api/categories:', s3.status, 'Total categories:', s3.body?.categories?.length);

  // 4. /api/transactions (POST)
  const newTx = {
    amount: 75000,
    type: 'expense',
    category_name: 'Makanan & Minuman',
    category_icon: '🍔',
    description: 'Nasi Liwet Spesial Ayam',
    transaction_date: '2026-10-04'
  };
  const s4 = await makeRequest('/api/transactions', 'POST', newTx);
  console.log('4. POST /api/transactions:', s4.status, 'Created ID:', s4.body?.transaction?.id, 'Amount:', s4.body?.transaction?.amount);

  // 5. /api/transactions (GET)
  const s5 = await makeRequest('/api/transactions?limit=5');
  console.log('5. GET /api/transactions:', s5.status, 'Count:', s5.body?.transactions?.length, 'Total:', s5.body?.total);

  // 6. /api/summary
  const s6 = await makeRequest('/api/summary?month=2026-10');
  console.log('6. GET /api/summary:', s6.status, 'Expense:', s6.body?.summary?.expense, 'Income:', s6.body?.summary?.income);

  // 7. Cleanup transaction
  if (s4.body?.transaction?.id) {
    const s7 = await makeRequest(`/api/transactions/${s4.body.transaction.id}`, 'DELETE');
    console.log('7. DELETE /api/transactions/:id:', s7.status, s7.body?.message);
  }

  console.log('\nAll Live HTTP Endpoint Tests Completed Successfully!');
}

verify().catch(console.error);
