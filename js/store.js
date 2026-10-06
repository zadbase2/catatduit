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
    this.realtimeChannel = null;
    this.dbStatus = {
      connected: false,
      provider: 'initializing',
      engine: 'Memeriksa backend...',
      message: 'Mendeteksi database...'
    };

    this.init();
    this.initRealtimeSync();
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
          text: 'Halo! Saya asisten cerdas CatatDuit ✨. Ketik apa saja yang baru kamu beli atau dapatkan seperti chat biasa, saya yang atur pencatatannya!',
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

    // 6. Connect with Backend and Run Auto-Sync if Online
    setTimeout(() => {
      this.refreshDbStatus().then(() => {
        if (this.isOnline()) {
          this.syncWithCloud();
        }
      });
    }, 100);
  }

  // --- Realtime Cross-Tab Broadcast Channel ---
  initRealtimeSync() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.realtimeChannel = new BroadcastChannel('catatduit_realtime_sync');
        this.realtimeChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'DATA_CHANGED') {
            this.notify();
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization notice:', err);
      }
    }

    // Universal storage event listener for cross-tab sync fallback
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (
          e.key === this.STORAGE_KEYS.TRANSACTIONS ||
          e.key === this.STORAGE_KEYS.CATEGORIES ||
          e.key === this.STORAGE_KEYS.SETTINGS
        ) {
          this.notify();
        }
      });
    }
  }

  broadcastChange(reason = 'data_changed') {
    if (this.realtimeChannel) {
      try {
        this.realtimeChannel.postMessage({
          type: 'DATA_CHANGED',
          reason,
          timestamp: Date.now()
        });
      } catch (e) {
        // silent fallback
      }
    }
  }

  // --- Network & Base URL Helpers ---
  getApiBaseUrl() {
    // Detect Capacitor native platform or local file/localhost protocol
    const isCapacitorNative = !!(
      (typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
      (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.platform && window.Capacitor.platform !== 'web') ||
      (typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:')) ||
      (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '')
    );

    if (isCapacitorNative) {
      // Production Vercel URL for Capacitor native app
      return 'https://catatduit-seven.vercel.app';
    }

    // For standard web browser on Vercel or dev server: use relative path
    return '';
  }

  apiUrl(endpoint) {
    const base = this.getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${cleanEndpoint}`;
  }

  isOnline() {
    const settings = this.getSettings();
    if (settings.isOfflineMode) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    return true;
  }

  generateTransactionId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'tx-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8);
    }
    return 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
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
      const res = await fetch(this.apiUrl(`/api/db-status?_t=${Date.now()}`), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        this.dbStatus = data;
      } else {
        this.dbStatus = {
          connected: false,
          isCloudDb: false,
          provider: 'offline',
          engine: 'Tidak dapat terhubung ke server',
          message: 'Server backend merespons dengan kesalahan.'
        };
      }
    } catch (err) {
      this.dbStatus = {
        connected: false,
        isCloudDb: false,
        provider: 'offline',
        engine: 'Koneksi Offline',
        message: err.message
      };
    }
    this.notify();
    return this.dbStatus;
  }

  // Pull transactions from PostgreSQL (SOURCE OF TRUTH)
  async pullFromCloud() {
    if (!this.isOnline()) return false;

    try {
      const res = await fetch(this.apiUrl(`/api/transactions?limit=500&_t=${Date.now()}`), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) return false;

      const data = await res.json();
      const serverTxs = data.transactions || [];
      const localTxs = this.getTransactions();
      const pendingQueue = this.getPendingQueue();
      const pendingIds = new Set(pendingQueue.map(item => item.id || item.data?.id));

      // PostgreSQL as SOURCE OF TRUTH:
      const resultMap = new Map();

      // 1. Populate all server transactions (verified in PostgreSQL)
      serverTxs.forEach(st => {
        resultMap.set(st.id, {
          ...st,
          amount: Number(st.amount),
          sync_status: 'synced'
        });
      });

      // 2. Retain local transactions that are still in pending queue
      localTxs.forEach(lt => {
        if (lt.sync_status === 'pending' || pendingIds.has(lt.id)) {
          resultMap.set(lt.id, lt);
        }
      });

      // 3. Transactions deleted on server will naturally be absent from resultMap
      const merged = Array.from(resultMap.values());
      merged.sort((a, b) => new Date(b.transaction_date || b.created_at) - new Date(a.transaction_date || a.created_at));

      // Realtime Diff Check: only update storage and broadcast if actual difference exists
      const isDifferent = (merged.length !== localTxs.length) ||
        merged.some((m, idx) => {
          const l = localTxs[idx];
          return !l || m.id !== l.id || Number(m.amount) !== Number(l.amount) || m.description !== l.description || m.sync_status !== l.sync_status;
        });

      if (isDifferent) {
        this.saveTransactions(merged);
      }
      return true;
    } catch (err) {
      console.warn('pullFromCloud network error:', err.message);
      return false;
    }
  }

  async pullCategoriesFromCloud() {
    if (!this.isOnline()) return false;
    try {
      const catRes = await fetch(this.apiUrl(`/api/categories?_t=${Date.now()}`), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (catRes.ok) {
        const catData = await catRes.json();
        if (catData.categories && catData.categories.length > 0) {
          const currentCats = this.getCategories();
          if (JSON.stringify(catData.categories) !== JSON.stringify(currentCats)) {
            this.saveCategories(catData.categories);
          }
          return true;
        }
      }
    } catch (err) {
      console.warn('pullCategoriesFromCloud error:', err.message);
    }
    return false;
  }

  async syncWithCloud() {
    const settings = this.getSettings();
    if (settings.isOfflineMode) {
      return { success: false, message: 'Aplikasi sedang dalam Mode Offline (Simulasi).' };
    }
    if (!this.isOnline()) {
      return { success: false, message: 'Tidak ada koneksi internet. Data tersimpan aman di perangkat.' };
    }

    try {
      // 1. Push any pending queue to PostgreSQL (Idempotent Batch Sync)
      const queueResult = await this.syncPendingQueue();

      // 2. Pull latest transactions from PostgreSQL (Source of Truth)
      await this.pullFromCloud();

      // 3. Pull latest categories from PostgreSQL
      await this.pullCategoriesFromCloud();

      // 4. Update DB status
      await this.refreshDbStatus();

      let msg = 'Sinkronisasi dengan Database Cloud berhasil!';
      if (queueResult.synced > 0) {
        msg = `Berhasil menyinkronkan ${queueResult.synced} transaksi ke PostgreSQL!`;
      }
      if (queueResult.pending > 0) {
        msg += ` (${queueResult.pending} item masih dalam antrean retry).`;
      }

      return { success: true, message: msg };
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
    this.broadcastChange('transactions_updated');
  }

  addTransaction(txData) {
    const txs = this.getTransactions();
    const id = txData.id || this.generateTransactionId();
    const isOnlineNow = this.isOnline();

    const newTx = {
      id,
      type: txData.type,
      amount: Number(txData.amount),
      category_id: txData.category_id,
      category_name: txData.category_name,
      category_icon: txData.category_icon || '📦',
      description: txData.description || 'Transaksi',
      raw_input: txData.raw_input || '',
      ai_confidence: txData.ai_confidence !== undefined ? Number(txData.ai_confidence) : 0.95,
      transaction_date: txData.transaction_date || new Date().toISOString().split('T')[0],
      transaction_time: txData.transaction_time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'),
      sync_status: 'pending', // Pending until server explicitly acknowledges
      created_at: txData.created_at || new Date().toISOString()
    };

    // Optimistic local update
    txs.unshift(newTx);
    this.saveTransactions(txs);

    const queueItem = {
      action: 'CREATE',
      id: newTx.id,
      data: newTx,
      created_at: newTx.created_at
    };
    this.addToPendingQueue(queueItem);

    // Online push
    if (isOnlineNow) {
      this._pushTransactionToServer(newTx);
    }

    return newTx;
  }

  async _pushTransactionToServer(tx) {
    try {
      const res = await fetch(this.apiUrl('/api/transactions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      });

      if (res.ok) {
        const body = await res.json();
        const serverTx = body.transaction || tx;

        // Server confirmed! Update local cache with server record
        const currentTxs = this.getTransactions();
        const idx = currentTxs.findIndex(t => t.id === tx.id);
        if (idx !== -1) {
          currentTxs[idx] = { ...serverTx, sync_status: 'synced' };
          this.saveTransactions(currentTxs);
        }

        // Remove confirmed item from pending queue
        this.removeFromPendingQueue([tx.id]);
        this.notify();
      }
    } catch (err) {
      console.warn('Online CREATE push network notice, retained in queue:', err.message);
    }
  }

  updateTransaction(id, updatedFields) {
    const txs = this.getTransactions();
    const idx = txs.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const existingTx = txs[idx];
    const updatedTx = {
      ...existingTx,
      ...updatedFields,
      sync_status: 'pending',
      updated_at: new Date().toISOString()
    };

    txs[idx] = updatedTx;
    this.saveTransactions(txs);

    const queueItem = {
      action: 'UPDATE',
      id,
      data: { ...updatedFields, id },
      created_at: new Date().toISOString()
    };
    this.addToPendingQueue(queueItem);

    if (this.isOnline()) {
      this._pushUpdateToServer(id, updatedFields, updatedTx);
    }

    return updatedTx;
  }

  async _pushUpdateToServer(id, updatedFields, fallbackTx) {
    try {
      const res = await fetch(this.apiUrl(`/api/transactions/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedFields, id })
      });

      if (res.ok) {
        const body = await res.json();
        const serverTx = body.transaction || fallbackTx;

        const currentTxs = this.getTransactions();
        const currentIdx = currentTxs.findIndex(t => t.id === id);
        if (currentIdx !== -1) {
          currentTxs[currentIdx] = { ...currentTxs[currentIdx], ...serverTx, sync_status: 'synced' };
          this.saveTransactions(currentTxs);
        }

        this.removeFromPendingQueue([id]);
        this.notify();
      }
    } catch (err) {
      console.warn('Online UPDATE push network notice, retained in queue:', err.message);
    }
  }

  deleteTransaction(id) {
    const txs = this.getTransactions();
    const filtered = txs.filter(t => t.id !== id);
    this.saveTransactions(filtered);

    const queueItem = {
      action: 'DELETE',
      id,
      data: { id },
      created_at: new Date().toISOString()
    };
    this.addToPendingQueue(queueItem);

    if (this.isOnline()) {
      this._pushDeleteToServer(id);
    }

    return true;
  }

  async _pushDeleteToServer(id) {
    try {
      const res = await fetch(this.apiUrl(`/api/transactions/${id}`), {
        method: 'DELETE'
      });

      if (res.ok) {
        this.removeFromPendingQueue([id]);
        this.notify();
      }
    } catch (err) {
      console.warn('Online DELETE push network notice, retained in queue:', err.message);
    }
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
    this.broadcastChange('categories_updated');
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
    fetch(this.apiUrl('/api/categories'), {
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
    fetch(this.apiUrl(`/api/categories/${id}`), {
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
    const itemId = item.id || item.data?.id;

    const existingIdx = queue.findIndex(q => (q.id || q.data?.id) === itemId);

    if (existingIdx !== -1) {
      const existing = queue[existingIdx];
      if (existing.action === 'CREATE' && item.action === 'UPDATE') {
        queue[existingIdx] = {
          ...existing,
          data: { ...existing.data, ...item.data },
          updated_at: new Date().toISOString()
        };
      } else if (existing.action === 'CREATE' && item.action === 'DELETE') {
        // Created offline, deleted offline before server ever saw it: remove completely
        queue.splice(existingIdx, 1);
      } else {
        queue[existingIdx] = item;
      }
    } else {
      queue.push(item);
    }

    this.savePendingQueue(queue);
  }

  removeFromPendingQueue(idsToRemove) {
    if (!idsToRemove || idsToRemove.length === 0) return;
    const idSet = new Set(idsToRemove);
    const queue = this.getPendingQueue();
    const remaining = queue.filter(item => !idSet.has(item.id || item.data?.id));
    this.savePendingQueue(remaining);
  }

  async syncPendingQueue() {
    const queue = this.getPendingQueue();
    if (queue.length === 0) return { synced: 0, pending: 0 };
    if (!this.isOnline()) return { synced: 0, pending: queue.length };

    try {
      const res = await fetch(this.apiUrl('/api/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: queue })
      });

      if (res.ok) {
        const result = await res.json();
        const syncedIds = result.syncedIds || [];

        if (syncedIds.length > 0) {
          const syncedSet = new Set(syncedIds);

          // Update local transactions status
          const txs = this.getTransactions();
          let modified = false;
          txs.forEach(t => {
            if (syncedSet.has(t.id)) {
              t.sync_status = 'synced';
              modified = true;
            }
          });
          if (modified) this.saveTransactions(txs);

          // Update chat history status
          const history = this.getChatHistory();
          let histMod = false;
          history.forEach(m => {
            if (m.parsedTx && syncedSet.has(m.parsedTx.id)) {
              m.pending = false;
              m.synced = true;
              histMod = true;
            }
          });
          if (histMod) this.saveChatHistory(history);

          // Remove ONLY confirmed synced IDs (Partial Queue Resolution)
          this.removeFromPendingQueue(syncedIds);
        }

        const remainingQueue = this.getPendingQueue();
        return {
          synced: syncedIds.length,
          pending: remainingQueue.length,
          errors: result.errors || []
        };
      }
    } catch (err) {
      console.warn('syncPendingQueue network failure, queue retained:', err.message);
    }

    return { synced: 0, pending: this.getPendingQueue().length };
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
