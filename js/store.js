/**
 * CatatDuit - State Store (Dexie.js / Zustand Simulation)
 * Integrated with Backend REST API & Vercel Postgres Database Engine
 * Based on PRD section 4.2 & 6
 */

const DEFAULT_GEMINI_KEY = '';

class CatatDuitStore {
  constructor() {
    this.STORAGE_KEYS = {
      TRANSACTIONS: 'catatduit_transactions_v1',
      CATEGORIES: 'catatduit_categories_v1',
      SETTINGS: 'catatduit_settings_v1',
      CHAT_HISTORY: 'catatduit_chat_history_v1',
      PENDING_QUEUE: 'catatduit_pending_queue_v1'
    };

    this.listeners = new Set();
    this.dbStatus = {
      connected: false,
      provider: 'initializing',
      engine: 'Memeriksa backend...',
      message: 'Mendeteksi database...'
    };

    this.init();
  }

  init() {
    // 1. Categories
    const storedCategories = localStorage.getItem(this.STORAGE_KEYS.CATEGORIES);
    if (!storedCategories) {
      localStorage.setItem(this.STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    }

    // 2. Transactions
    const storedTransactions = localStorage.getItem(this.STORAGE_KEYS.TRANSACTIONS);
    if (!storedTransactions) {
      localStorage.setItem(this.STORAGE_KEYS.TRANSACTIONS, JSON.stringify(getSampleTransactions()));
    }

    // 3. Settings
    const storedSettings = localStorage.getItem(this.STORAGE_KEYS.SETTINGS);
    let settings = null;
    try {
      settings = storedSettings ? JSON.parse(storedSettings) : null;
    } catch {
      settings = null;
    }

    if (!settings) {
      const defaultSettings = {
        theme: 'light',
        currency: 'IDR',
        isOfflineMode: false,
        userName: 'Azriel',
        userEmail: 'azriel@example.com',
        geminiApiKey: DEFAULT_GEMINI_KEY,
        geminiModel: 'auto',
        aiStatus: 'active',
        quickActions: INITIAL_QUICK_ACTIONS
      };
      localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
    } else {
      let changed = false;
      if (!settings.userName || settings.userName === 'Ahmad Faiz') {
        settings.userName = 'Azriel';
        settings.userEmail = 'azriel@example.com';
        changed = true;
      }
      if (!settings.geminiApiKey) {
        settings.geminiApiKey = DEFAULT_GEMINI_KEY;
        settings.geminiModel = settings.geminiModel || 'auto';
        changed = true;
      }
      if (changed) {
        localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      }
    }

    // 4. Pending Queue
    if (!localStorage.getItem(this.STORAGE_KEYS.PENDING_QUEUE)) {
      localStorage.setItem(this.STORAGE_KEYS.PENDING_QUEUE, JSON.stringify([]));
    }

    // 5. Initial Chat History if empty
    if (!localStorage.getItem(this.STORAGE_KEYS.CHAT_HISTORY)) {
      const initialChat = [
        {
          id: 'msg-welcome-1',
          sender: 'ai',
          text: 'Halo! Saya asisten pintar CatatDuit 🤖. Ketik apa saja yang baru kamu beli atau dapatkan seperti chat biasa, saya yang atur pencatatannya!',
          timestamp: new Date().toISOString()
        },
        {
          id: 'msg-welcome-2',
          sender: 'ai',
          text: '💡 Contoh: *"beli esteh 2 harga 5k"*, *"gajian 5jt"*, atau klik tombol cepat di bawah.',
          timestamp: new Date().toISOString()
        }
      ];
      localStorage.setItem(this.STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(initialChat));
    }

    // 6. Connect with Backend and Check DB Status
    setTimeout(() => {
      this.refreshDbStatus().then(() => {
        this.syncPendingQueue();
      });
    }, 100);
  }

  // Reactive listener subscription
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(fn => {
      try { fn(this); } catch (e) { console.error('Store listener error:', e); }
    });
  }

  // --- Backend / DB Cloud Health ---
  async refreshDbStatus() {
    try {
      const res = await fetch('/api/db-status');
      if (res.ok) {
        const data = await res.json();
        this.dbStatus = data;
      } else {
        this.dbStatus = {
          connected: false,
          provider: 'offline',
          engine: 'Tidak dapat terhubung ke server',
          message: 'Server backend tidak merespons.'
        };
      }
    } catch (err) {
      this.dbStatus = {
        connected: false,
        provider: 'offline',
        engine: 'Koneksi Offline',
        message: err.message
      };
    }
    this.notify();
    return this.dbStatus;
  }

  async syncWithCloud() {
    const settings = this.getSettings();
    if (settings.isOfflineMode) {
      return { success: false, message: 'Aplikasi sedang dalam Mode Offline (Simulasi).' };
    }

    try {
      // 1. Flush any pending queue
      const pending = this.getPendingQueue();
      if (pending.length > 0) {
        const syncRes = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: pending })
        });
        if (syncRes.ok) {
          localStorage.setItem(this.STORAGE_KEYS.PENDING_QUEUE, JSON.stringify([]));
        }
      }

      // 2. Pull transactions from backend
      const txRes = await fetch('/api/transactions?limit=250');
      if (txRes.ok) {
        const txData = await txRes.json();
        if (txData.transactions && txData.transactions.length > 0) {
          // Merge local and cloud transactions by ID
          const localTxs = this.getTransactions();
          const txMap = new Map();
          localTxs.forEach(t => txMap.set(t.id, t));
          txData.transactions.forEach(t => txMap.set(t.id, { ...t, sync_status: 'synced' }));

          const merged = Array.from(txMap.values());
          merged.sort((a, b) => new Date(b.transaction_date || b.created_at) - new Date(a.transaction_date || a.created_at));
          this.saveTransactions(merged);
        } else {
          // If cloud is empty but local has data, upload local transactions
          const localTxs = this.getTransactions();
          if (localTxs.length > 0) {
            const batch = localTxs.map(t => ({ action: 'CREATE', data: t }));
            await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: batch })
            });
          }
        }
      }

      // 3. Pull categories from backend
      const catRes = await fetch('/api/categories');
      if (catRes.ok) {
        const catData = await catRes.json();
        if (catData.categories && catData.categories.length > 0) {
          this.saveCategories(catData.categories);
        }
      }

      await this.refreshDbStatus();
      return { success: true, message: 'Sinkronisasi dengan Database Cloud berhasil!' };
    } catch (err) {
      console.error('syncWithCloud error:', err);
      return { success: false, message: `Gagal sinkronisasi: ${err.message}` };
    }
  }

  // --- Transactions ---
  getTransactions() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.TRANSACTIONS)) || [];
    } catch {
      return [];
    }
  }

  saveTransactions(txs) {
    localStorage.setItem(this.STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txs));
    this.notify();
  }

  addTransaction(txData) {
    const txs = this.getTransactions();
    const settings = this.getSettings();
    const isOffline = settings.isOfflineMode;

    const newTx = {
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      type: txData.type,
      amount: Number(txData.amount),
      category_id: txData.category_id,
      category_name: txData.category_name,
      category_icon: txData.category_icon || '📦',
      description: txData.description || 'Transaksi',
      raw_input: txData.raw_input || '',
      ai_confidence: txData.ai_confidence || 0.95,
      transaction_date: txData.transaction_date || new Date().toISOString().split('T')[0],
      transaction_time: txData.transaction_time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'),
      sync_status: isOffline ? 'pending' : 'synced',
      created_at: new Date().toISOString()
    };

    txs.unshift(newTx);
    this.saveTransactions(txs);

    if (isOffline) {
      this.addToPendingQueue({
        action: 'CREATE',
        entity: 'transaction',
        data: newTx,
        created_at: new Date().toISOString()
      });
    } else {
      // Async background sync to backend
      fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTx)
      }).catch(err => {
        console.warn('Backend sync failed, queueing offline:', err.message);
        this.addToPendingQueue({
          action: 'CREATE',
          entity: 'transaction',
          data: newTx,
          created_at: new Date().toISOString()
        });
      });
    }

    return newTx;
  }

  updateTransaction(id, updatedFields) {
    const txs = this.getTransactions();
    const idx = txs.findIndex(t => t.id === id);
    if (idx !== -1) {
      txs[idx] = { ...txs[idx], ...updatedFields, updated_at: new Date().toISOString() };
      this.saveTransactions(txs);

      const settings = this.getSettings();
      if (!settings.isOfflineMode) {
        fetch(`/api/transactions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFields)
        }).catch(err => console.warn('Update cloud sync failed:', err.message));
      }

      return txs[idx];
    }
    return null;
  }

  deleteTransaction(id) {
    const txs = this.getTransactions();
    const filtered = txs.filter(t => t.id !== id);
    this.saveTransactions(filtered);

    const settings = this.getSettings();
    if (!settings.isOfflineMode) {
      fetch(`/api/transactions/${id}`, {
        method: 'DELETE'
      }).catch(err => console.warn('Delete cloud sync failed:', err.message));
    }

    return true;
  }

  // --- Categories ---
  getCategories() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.CATEGORIES)) || DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  }

  saveCategories(cats) {
    localStorage.setItem(this.STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
    this.notify();
  }

  addCategory(cat) {
    const cats = this.getCategories();
    const newCat = {
      id: 'cat-custom-' + Date.now(),
      name: cat.name,
      type: cat.type,
      icon: cat.icon || '🏷️',
      color: cat.color || '#3B82F6',
      is_default: false
    };
    cats.push(newCat);
    this.saveCategories(cats);

    // Sync to backend
    fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCat)
    }).catch(err => console.warn('Category cloud sync failed:', err.message));

    return newCat;
  }

  deleteCategory(id) {
    const cats = this.getCategories();
    const targetCat = cats.find(c => c.id === id);
    if (!targetCat) return { success: false, message: 'Kategori tidak ditemukan.' };

    if (targetCat.name.toLowerCase() === 'lainnya') {
      return { success: false, message: 'Kategori "Lainnya" adalah kategori sistem dan tidak dapat dihapus.' };
    }

    let fallbackCat = cats.find(c => c.type === targetCat.type && c.name.toLowerCase() === 'lainnya');
    if (!fallbackCat) {
      fallbackCat = {
        id: targetCat.type === 'income' ? 'cat-inc-5' : 'cat-exp-8',
        name: 'Lainnya',
        type: targetCat.type,
        icon: '📦',
        color: '#6B7280',
        is_default: true
      };
      cats.push(fallbackCat);
    }

    // Reassign transactions that belong to this deleted category
    const txs = this.getTransactions();
    let reassignedCount = 0;
    txs.forEach(t => {
      if (t.category_id === id || t.category_name === targetCat.name) {
        t.category_id = fallbackCat.id;
        t.category_name = fallbackCat.name;
        t.category_icon = fallbackCat.icon;
        reassignedCount++;
      }
    });
    if (reassignedCount > 0) {
      this.saveTransactions(txs);
    }

    // Also update any pending queue transactions if offline
    const pending = this.getPendingQueue();
    let pendingReassigned = 0;
    pending.forEach(t => {
      if (t.category_id === id || t.category_name === targetCat.name) {
        t.category_id = fallbackCat.id;
        t.category_name = fallbackCat.name;
        t.category_icon = fallbackCat.icon;
        pendingReassigned++;
      }
    });
    if (pendingReassigned > 0) {
      this.savePendingQueue(pending);
    }

    // Remove category from store
    const updatedCats = cats.filter(c => c.id !== id);
    this.saveCategories(updatedCats);

    // Call backend API to delete & reassign in cloud database
    fetch(`/api/categories/${id}`, {
      method: 'DELETE'
    }).catch(err => console.warn('Delete category cloud sync failed:', err.message));

    this.notify();

    return {
      success: true,
      categoryName: targetCat.name,
      reassignedCount: reassignedCount + pendingReassigned,
      fallbackName: fallbackCat.name
    };
  }

  // --- Settings ---
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.SETTINGS)) || {};
    } catch {
      return {};
    }
  }

  updateSettings(partial) {
    const current = this.getSettings();
    const updated = { ...current, ...partial };
    localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  getGeminiApiKey() {
    const settings = this.getSettings();
    return settings.geminiApiKey || DEFAULT_GEMINI_KEY;
  }

  setGeminiApiKey(key) {
    return this.updateSettings({ geminiApiKey: key });
  }

  // --- Chat History ---
  getChatHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.CHAT_HISTORY)) || [];
    } catch {
      return [];
    }
  }

  saveChatHistory(history) {
    localStorage.setItem(this.STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(history));
  }

  addChatMessage(msg) {
    const history = this.getChatHistory();
    history.push({
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      ...msg,
      timestamp: new Date().toISOString()
    });
    this.saveChatHistory(history);
    return history;
  }

  clearChatHistory() {
    localStorage.removeItem(this.STORAGE_KEYS.CHAT_HISTORY);
    this.init();
    this.notify();
  }

  // --- Offline & Pending Queue Sync ---
  getPendingQueue() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.PENDING_QUEUE)) || [];
    } catch {
      return [];
    }
  }

  savePendingQueue(q) {
    localStorage.setItem(this.STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(q));
    this.notify();
  }

  addToPendingQueue(item) {
    const queue = this.getPendingQueue();
    queue.push(item);
    this.savePendingQueue(queue);
  }

  syncPendingQueue() {
    const queue = this.getPendingQueue();
    const txs = this.getTransactions();
    let syncedCount = 0;

    txs.forEach(t => {
      if (t.sync_status === 'pending') {
        t.sync_status = 'synced';
        syncedCount++;
      }
    });

    const history = this.getChatHistory();
    let historyUpdated = false;
    history.forEach(m => {
      if (m.pending) {
        m.pending = false;
        m.synced = true;
        historyUpdated = true;
      }
    });
    if (historyUpdated) {
      this.saveChatHistory(history);
    }

    if (queue.length > 0) {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: queue })
      }).then(() => {
        localStorage.setItem(this.STORAGE_KEYS.PENDING_QUEUE, JSON.stringify([]));
      }).catch(err => {
        console.warn('Backend sync failed, queue retained:', err.message);
      });
    }

    this.saveTransactions(txs);
    return Math.max(syncedCount, queue.length);
  }

  // --- Analytics & Summaries ---
  getTodaySummary() {
    const today = new Date().toISOString().split('T')[0];
    const txs = this.getTransactions().filter(t => t.transaction_date === today);

    let income = 0;
    let expense = 0;

    txs.forEach(t => {
      if (t.type === 'income') income += Number(t.amount);
      else expense += Number(t.amount);
    });

    return {
      income,
      expense,
      balance: income - expense,
      count: txs.length
    };
  }

  getOverallSummary(filterPeriod = 'all') {
    const txs = this.getTransactions();
    const now = new Date();

    const filtered = txs.filter(t => {
      if (filterPeriod === 'all') return true;
      const tDate = new Date(t.transaction_date);
      const diffDays = Math.floor((now - tDate) / (1000 * 60 * 60 * 24));

      if (filterPeriod === 'today') return diffDays === 0;
      if (filterPeriod === '7d') return diffDays <= 7;
      if (filterPeriod === '30d') return diffDays <= 30;
      if (filterPeriod === 'month') {
        return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      }
      return true;
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryBreakdown = {};

    filtered.forEach(t => {
      const amt = Number(t.amount);
      if (t.type === 'income') {
        totalIncome += amt;
      } else {
        totalExpense += amt;
        const cat = t.category_name || 'Lainnya';
        if (!categoryBreakdown[cat]) {
          categoryBreakdown[cat] = {
            name: cat,
            icon: t.category_icon || '📦',
            total: 0,
            count: 0
          };
        }
        categoryBreakdown[cat].total += amt;
        categoryBreakdown[cat].count += 1;
      }
    });

    const balance = totalIncome - totalExpense;
    const savingsRatio = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;
    const topCategories = Object.values(categoryBreakdown).sort((a, b) => b.total - a.total);

    let healthScore = 70;
    if (savingsRatio >= 20) healthScore += 15;
    else if (savingsRatio < 0) healthScore -= 25;
    if (totalExpense > 0 && totalIncome > totalExpense) healthScore += 10;
    healthScore = Math.max(10, Math.min(99, healthScore));

    return {
      filteredTransactions: filtered,
      totalIncome,
      totalExpense,
      balance,
      savingsRatio,
      healthScore,
      categoryBreakdown: topCategories
    };
  }

  // --- Reset & Seed ---
  loadSampleData() {
    localStorage.setItem(this.STORAGE_KEYS.TRANSACTIONS, JSON.stringify(getSampleTransactions()));
    localStorage.setItem(this.STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    this.notify();
    this.syncWithCloud();
  }

  clearAllData() {
    localStorage.setItem(this.STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
    localStorage.setItem(this.STORAGE_KEYS.PENDING_QUEUE, JSON.stringify([]));
    localStorage.setItem(this.STORAGE_KEYS.CHAT_HISTORY, JSON.stringify([]));
    this.notify();
  }

  // --- Export Helpers ---
  exportCSV() {
    const txs = this.getTransactions();
    const headers = ['ID', 'Tipe', 'Tanggal', 'Kategori', 'Keterangan', 'Nominal (IDR)', 'Input Asli', 'Status Sync'];
    const rows = txs.map(t => [
      t.id,
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      t.transaction_date,
      `"${(t.category_name || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${(t.raw_input || '').replace(/"/g, '""')}"`,
      t.sync_status
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CatatDuit_Transaksi_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportJSON() {
    const data = {
      transactions: this.getTransactions(),
      categories: this.getCategories(),
      settings: this.getSettings(),
      exported_at: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CatatDuit_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

// Global store instance
window.store = new CatatDuitStore();
