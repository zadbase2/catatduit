/**
 * Automated Verification Script for CatatDuit Backend & Database Engine
 * Tests both API handlers and DB operations
 */

const http = require('http');
const db = require('./db');
const { handlers } = require('./api-handlers');

async function runTests() {
  console.log('====================================================');
  console.log('  CatatDuit Backend & Database Engine Automated Test');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraInfo = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName} ${extraInfo}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${extraInfo}`);
      failed++;
    }
  }

  try {
    // Test 1: Database Initialization
    console.log('[1] Testing Database Initialization...');
    const initRes = await db.initDatabase();
    assert(initRes && initRes.success, 'initDatabase() executes without errors', `(engine: ${initRes.engine})`);

    // Test 2: Database Status Endpoint
    console.log('\n[2] Testing /api/db-status...');
    const statusRes = await handlers.getDbStatus();
    assert(statusRes.status === 200, 'getDbStatus returns 200 OK');
    assert(statusRes.body.connected === true, 'Database is reported as connected');
    assert(statusRes.body.provider !== undefined, 'Database provider defined', `(${statusRes.body.provider} - ${statusRes.body.engine})`);

    // Test 3: Categories Retrieval
    console.log('\n[3] Testing /api/categories (GET)...');
    const catRes = await handlers.getCategories();
    assert(catRes.status === 200, 'getCategories returns 200 OK');
    assert(Array.isArray(catRes.body.categories), 'Categories is an array');
    assert(catRes.body.categories.length >= 10, 'Has default categories populated', `(count: ${catRes.body.categories.length})`);

    // Test 4: Add Custom Category
    console.log('\n[4] Testing /api/categories (POST)...');
    const testCatPayload = {
      name: 'Uji Coba Kategori ' + Date.now(),
      type: 'expense',
      icon: '🧪',
      color: '#10B981'
    };
    const addCatRes = await handlers.addCategory(testCatPayload);
    assert(addCatRes.status === 201, 'addCategory returns 201 Created');
    assert(addCatRes.body.category.name === testCatPayload.name, 'Category name matches');
    const createdCatId = addCatRes.body.category.id;

    // Test 5: Create Transaction
    console.log('\n[5] Testing /api/transactions (POST)...');
    const testTxPayload = {
      amount: 45000,
      type: 'expense',
      category_id: createdCatId,
      category_name: testCatPayload.name,
      category_icon: testCatPayload.icon,
      description: 'Beli Perlengkapan Uji',
      raw_input: 'beli perlengkapan uji 45k',
      ai_confidence: 0.96,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_time: '14:30'
    };
    const createTxRes = await handlers.createTransaction(testTxPayload);
    assert(createTxRes.status === 201, 'createTransaction returns 201 Created');
    assert(Number(createTxRes.body.transaction.amount) === 45000, 'Transaction amount is 45000');
    const createdTxId = createTxRes.body.transaction.id;

    // Test 6: Fetch Transactions
    console.log('\n[6] Testing /api/transactions (GET)...');
    const getTxsRes = await handlers.getTransactions({ limit: 10 });
    assert(getTxsRes.status === 200, 'getTransactions returns 200 OK');
    assert(Array.isArray(getTxsRes.body.transactions), 'Transactions list returned as array');
    const found = getTxsRes.body.transactions.find(t => t.id === createdTxId);
    assert(!!found, 'Created transaction found in list');

    // Test 7: Update Transaction
    console.log('\n[7] Testing /api/transactions/:id (PUT)...');
    const updateRes = await handlers.updateTransaction(createdTxId, {
      amount: 50000,
      description: 'Beli Perlengkapan Uji (Revisi)'
    });
    assert(updateRes.status === 200, 'updateTransaction returns 200 OK');
    assert(Number(updateRes.body.transaction.amount) === 50000, 'Transaction updated amount is 50000');
    assert(updateRes.body.transaction.description === 'Beli Perlengkapan Uji (Revisi)', 'Description updated');

    // Test 8: Monthly Summary
    console.log('\n[8] Testing /api/summary (GET)...');
    const summaryRes = await handlers.getSummary({ month: new Date().toISOString().slice(0, 7) });
    assert(summaryRes.status === 200, 'getSummary returns 200 OK');
    assert(typeof summaryRes.body.summary.expense === 'number', 'Summary contains numeric expense', `(total: ${summaryRes.body.summary.expense})`);

    // Test 9: Delete Category with Auto-Reassignment
    console.log('\n[9] Testing /api/categories/:id (DELETE) & Auto-Reassignment to Lainnya...');
    const delCatRes = await handlers.deleteCategory(createdCatId);
    assert(delCatRes.status === 200, 'deleteCategory returns 200 OK');
    assert(delCatRes.body.reassignedCount >= 1, 'Transaction was reassigned to Lainnya', `(reassigned: ${delCatRes.body.reassignedCount})`);

    // Check if the transaction's category is now Lainnya
    const verifyTxs = await handlers.getTransactions({ limit: 50 });
    const reassignedTx = verifyTxs.body.transactions.find(t => t.id === createdTxId);
    assert(reassignedTx && reassignedTx.category_name === 'Lainnya', 'Transaction category_name correctly updated to Lainnya');

    // Test 10: Batch Sync (Offline Queue)
    console.log('\n[10] Testing /api/sync (POST)...');
    const syncPayload = [
      {
        action: 'CREATE',
        data: {
          id: 'tx-sync-test-1',
          amount: 15000,
          type: 'expense',
          category_name: 'Makanan & Minuman',
          category_icon: '🍔',
          description: 'Sync Test Nasi Bungkus',
          transaction_date: new Date().toISOString().split('T')[0]
        }
      },
      {
        action: 'UPDATE',
        data: {
          id: 'tx-sync-test-1',
          description: 'Sync Test Nasi Bungkus Komplit'
        }
      }
    ];
    const syncRes = await handlers.syncTransactions(syncPayload);
    assert(syncRes.status === 200, 'syncTransactions returns 200 OK');
    assert(syncRes.body.synced === 2, 'Both queued operations synced successfully');

    // Test 11: Cleanup created transactions
    console.log('\n[11] Testing /api/transactions/:id (DELETE)...');
    const delTx1 = await handlers.deleteTransaction(createdTxId);
    const delTx2 = await handlers.deleteTransaction('tx-sync-test-1');
    assert(delTx1.status === 200 && delTx2.status === 200, 'Transactions deleted cleanly');

  } catch (err) {
    console.error('Unexpected test exception:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`  Automated Test Finished: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
