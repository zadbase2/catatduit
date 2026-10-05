/**
 * CatatDuit - UI Controller & Interactions
 */

const UI = {
  activeTab: 'dashboard',
  activePeriodFilter: 'all',
  incomeFilterPeriod: 'all',
  expenseFilterPeriod: 'all',
  searchQueryIncome: '',
  searchQueryExpense: '',
  categoryFilterIncome: 'all',
  categoryFilterExpense: 'all',
  sortIncome: 'date-desc',
  sortExpense: 'date-desc',

  currentEditingTxId: null,
  isBalanceHidden: false,
  mobileWifiUrl: 'http://192.168.100.20:3000',

  init() {
    this.parser = new AIParser(window.store.getCategories());
    this.bindEvents();
    this.renderAll();
    this.loadConfigFromServer();

    // Subscribe to store updates
    window.store.subscribe(() => {
      this.parser.setCategories(window.store.getCategories());
      this.renderAll();
    });
  },

  async loadConfigFromServer() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const config = await res.json();
        if (config.mobileUrl) {
          this.mobileWifiUrl = config.mobileUrl;
        }

        // Handle server AI key availability
        this.serverHasGeminiKey = !!config.hasGeminiKey;
        const geminiInput = document.getElementById('geminiApiKeyInput');
        if (geminiInput && !window.store.getGeminiApiKey() && this.serverHasGeminiKey) {
          geminiInput.placeholder = 'Menggunakan Gemini AI Server (Bisa isi jika punya key sendiri)';
        }

        // Update Wi-Fi chip texts
        const sidebarWifiText = document.getElementById('sidebarWifiText');
        if (sidebarWifiText && config.networkIp) {
          sidebarWifiText.textContent = `Wi-Fi: ${config.networkIp}:${config.port || 3000}`;
        }
        const headerWifiText = document.getElementById('headerWifiText');
        if (headerWifiText && config.networkIp) {
          headerWifiText.textContent = `${config.networkIp}:${config.port || 3000}`;
        }

        // Update settings Wi-Fi input
        const wifiInput = document.getElementById('settingsWifiUrlInput');
        if (wifiInput) {
          wifiInput.value = this.mobileWifiUrl;
        }
      }
    } catch (err) {
      console.warn('Could not fetch server config:', err);
    }
  },

  copyWifiUrl() {
    const url = this.mobileWifiUrl || `http://${window.location.hostname || '192.168.100.20'}:3000`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast(`📱 Alamat Wi-Fi disalin: ${url} (Buka di browser HP kamu!)`, 'success');
      }).catch(() => {
        this.fallbackCopy(url);
      });
    } else {
      this.fallbackCopy(url);
    }

    const badge = document.querySelector('#headerWifiBtn .copy-badge');
    if (badge) {
      const oldText = badge.textContent;
      badge.textContent = 'Tersalin! ✓';
      badge.style.background = 'var(--income)';
      badge.style.color = '#fff';
      setTimeout(() => {
        badge.textContent = oldText;
        badge.style.background = '';
        badge.style.color = '';
      }, 2000);
    }
  },

  fallbackCopy(text) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    this.showToast(`📱 Alamat Wi-Fi disalin: ${text} (Buka di browser HP kamu!)`, 'success');
  },

  formatIDR(num) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(num);
  },

  formatDate(dateStr, timeStr = null) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const dateFormatted = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    let time = timeStr;
    if (!time && dateStr.includes('T')) {
      const timePart = dateStr.split('T')[1];
      if (timePart) {
        time = timePart.substring(0, 5);
      }
    }

    if (time) {
      return `${dateFormatted}, ${time}`;
    }
    return dateFormatted;
  },

  toggleMobileDrawer(open = null) {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar) return;
    const isOpen = open !== null ? open : !sidebar.classList.contains('drawer-open');
    sidebar.classList.toggle('drawer-open', isOpen);
    if (backdrop) backdrop.classList.toggle('active', isOpen);
  },

  // Switch between tabs
  switchTab(tabName) {
    this.activeTab = tabName;
    this.toggleMobileDrawer(false);

    // Update active class on panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    const targetPane = document.getElementById(`tab-${tabName}`);
    if (targetPane) targetPane.classList.add('active');

    // Update active class on sidebar items
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Update active class on mobile bottom tabs
    document.querySelectorAll('.mobile-nav-btn, .bottom-tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Re-render tab specific content
    if (tabName === 'dashboard') {
      this.renderDashboardView();
    } else if (tabName === 'chat') {
      this.scrollToBottomChat();
    } else if (tabName === 'stats') {
      this.renderStatsView();
    } else if (tabName === 'income') {
      this.renderIncomeView();
    } else if (tabName === 'expense') {
      this.renderExpenseView();
    } else if (tabName === 'settings') {
      this.renderSettingsView();
    }
  },

  renderAll() {
    this.renderHeaderStatus();
    this.renderDashboardView();
    this.renderChatMessages();
    this.renderQuickActions();
    this.renderIncomeView();
    this.renderExpenseView();
    this.renderStatsView();
    this.renderSettingsView();
    this.populateCategorySelects();
  },

  // Header & Status
  renderHeaderStatus() {
    const settings = window.store.getSettings();
    const pendingQueue = window.store.getPendingQueue();
    const isOffline = settings.isOfflineMode;

    const syncIndicator = document.getElementById('syncStatusIndicator');
    const syncText = document.getElementById('syncStatusText');
    const offlineBanner = document.getElementById('offlineSyncBanner');

    if (syncIndicator && syncText) {
      if (isOffline) {
        syncIndicator.className = 'sync-indicator-btn offline';
        syncText.textContent = pendingQueue.length > 0
          ? `Offline (${pendingQueue.length} Pending)`
          : 'Offline';
        syncIndicator.title = 'Mode Offline Aktif - Klik untuk Aktifkan Online & Sinkronkan Otomatis!';
      } else {
        syncIndicator.className = 'sync-indicator-btn online';
        syncText.textContent = 'Online (Synced)';
        syncIndicator.title = 'Online & Terhubung - Klik untuk Simulasi Mode Offline';
      }
    }

    if (offlineBanner) {
      if (isOffline && pendingQueue.length > 0) {
        offlineBanner.style.display = 'flex';
        offlineBanner.innerHTML = `
          <span>⏳ Mode Offline: Ada <strong>${pendingQueue.length} transaksi</strong> dalam antrean pending.</span>
          <button class="btn btn-sm btn-primary" onclick="UI.toggleOfflineSimulator()">Kembali Online & Auto-Sync</button>
        `;
      } else {
        offlineBanner.style.display = 'none';
      }
    }

    // Apply Theme
    document.documentElement.setAttribute('data-theme', settings.theme || 'light');
    const themeIcon = document.getElementById('themeToggleBtn');
    if (themeIcon) {
      themeIcon.innerHTML = settings.theme === 'light' ? '🌙' : '☀️';
      themeIcon.title = settings.theme === 'light' ? 'Ganti ke Mode Gelap' : 'Ganti ke Mode Terang';
    }
  },

  toggleTheme() {
    const current = window.store.getSettings().theme;
    const next = current === 'light' ? 'dark' : 'light';
    window.store.updateSettings({ theme: next });
    this.showToast(`Mode tema diubah ke ${next === 'dark' ? 'Gelap' : 'Terang'}`, 'info');
  },

  toggleMobileFrame() {
    document.body.classList.toggle('mobile-frame-mode');
    const isFrame = document.body.classList.contains('mobile-frame-mode');
    const btn = document.getElementById('frameToggleBtn');
    if (btn) {
      btn.innerHTML = isFrame ? '💻 Desktop View' : '📱 Mobile View';
    }
  },

  // Toggle Offline/Online Simulator with Auto-Sync
  toggleOfflineSimulator() {
    const current = window.store.getSettings().isOfflineMode;
    this.handleNetworkStatusChange(current); // if current was offline, switch to online (true)
  },

  // Network status handler (called by online/offline events or manual toggle)
  handleNetworkStatusChange(isOnline) {
    const isOffline = !isOnline;
    window.store.updateSettings({ isOfflineMode: isOffline });

    const offlineSwitch = document.getElementById('offlineModeSwitch');
    if (offlineSwitch) offlineSwitch.checked = isOffline;

    if (isOnline) {
      // AUTOMATIC SYNC WHEN RETURNING ONLINE
      this.autoSync();
    } else {
      this.showToast('📶 Mode Offline Aktif. Transaksi baru akan masuk antrean pending.', 'warning');
      this.renderAll();
    }
  },

  // Automatic Synchronization Engine
  autoSync() {
    const syncedCount = window.store.syncPendingQueue();
    if (syncedCount > 0) {
      this.showToast(`⚡ Online terdeteksi! ${syncedCount} transaksi otomatis disinkronkan ke cloud & status pending dihapus.`, 'success');
    } else {
      this.showToast('🟢 Terhubung ke Online. Semua data tersinkronisasi.', 'info');
    }
    this.renderAll();
  },

  triggerSyncNow() {
    this.autoSync();
  },

  toggleBalanceVisibility() {
    this.isBalanceHidden = !this.isBalanceHidden;
    const btn = document.getElementById('balanceEyeBtn');
    if (btn) {
      btn.innerHTML = this.isBalanceHidden ? '🙈' : '👁️';
      btn.title = this.isBalanceHidden ? 'Tampilkan Nominal Saldo' : 'Sembunyikan Nominal Saldo';
    }
    const heroBalEl = document.getElementById('mainHeroBalance');
    if (heroBalEl) {
      const sumAll = window.store.getOverallSummary('all');
      heroBalEl.textContent = this.isBalanceHidden ? 'Rp ••••••••' : this.formatIDR(sumAll.balance);
    }
  },

  focusChatInput() {
    const input = document.getElementById('chatInputField');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  // TAB 1: Paper.id Dashboard View
  renderDashboardView() {
    const sumToday = window.store.getTodaySummary();
    const sumMonth = window.store.getOverallSummary('month');
    const sumAll = window.store.getOverallSummary('all');

    // Hero Total Saldo Aktif
    const heroBalEl = document.getElementById('mainHeroBalance');
    if (heroBalEl) {
      heroBalEl.textContent = this.isBalanceHidden ? 'Rp ••••••••' : this.formatIDR(sumAll.balance);
    }

    // Today balance
    const todayBalEl = document.getElementById('todayBalanceVal');
    if (todayBalEl) todayBalEl.textContent = this.formatIDR(sumToday.balance);

    // Monthly companion cards
    const monthIncEl = document.getElementById('heroMonthlyIncome');
    const monthExpEl = document.getElementById('heroMonthlyExpense');
    if (monthIncEl) monthIncEl.textContent = this.formatIDR(sumMonth.totalIncome);
    if (monthExpEl) monthExpEl.textContent = this.formatIDR(sumMonth.totalExpense);

    const todayIncEl = document.getElementById('todayIncomeVal');
    const todayExpEl = document.getElementById('todayExpenseVal');
    if (todayIncEl) todayIncEl.textContent = this.formatIDR(sumToday.income);
    if (todayExpEl) todayExpEl.textContent = this.formatIDR(sumToday.expense);

    // Metrics count badges
    const allTxs = window.store.getTransactions();
    const incCount = allTxs.filter(t => t.type === 'income').length;
    const expCount = allTxs.filter(t => t.type === 'expense').length;
    const incBadge = document.getElementById('dashIncomeCountBadge');
    if (incBadge) incBadge.textContent = `● ${incCount} Pemasukan Aktif`;
    const expBadge = document.getElementById('dashExpenseCountBadge');
    if (expBadge) expBadge.textContent = `● ${expCount} Pengeluaran Aktif`;

    // PaperPay In: Recent Incomes List
    const incContainer = document.getElementById('dashboardRecentIncomeList');
    if (incContainer) {
      const recentIncomes = allTxs.filter(t => t.type === 'income').slice(0, 4);
      if (recentIncomes.length === 0) {
        incContainer.innerHTML = `
          <div style="text-align: center; padding: 24px 10px; color: var(--text-muted); font-size: 12px;">
            Belum ada pemasukan tercatat.
          </div>
        `;
      } else {
        incContainer.innerHTML = recentIncomes.map(t => `
          <div class="paper-tx-item" onclick="UI.openTransactionModal('edit', '${t.id}')" title="Klik untuk edit/lihat detail">
            <div class="tx-item-left">
              <span class="tx-item-name">${t.description}</span>
              <span class="tx-item-date">${this.formatDate(t.transaction_date, t.transaction_time)} • ${t.category_name}</span>
            </div>
            <div class="tx-item-right">
              <span class="tx-item-amount tabular-nums">${this.formatIDR(t.amount)}</span>
              <span class="tx-item-status-pill success">Dana Diterima</span>
            </div>
          </div>
        `).join('');
      }
    }

    // PaperPay Out: Recent Expenses List
    const expContainer = document.getElementById('dashboardRecentExpenseList');
    if (expContainer) {
      const recentExpenses = allTxs.filter(t => t.type === 'expense').slice(0, 4);
      if (recentExpenses.length === 0) {
        expContainer.innerHTML = `
          <div style="text-align: center; padding: 24px 10px; color: var(--text-muted); font-size: 12px;">
            Belum ada pengeluaran tercatat.
          </div>
        `;
      } else {
        expContainer.innerHTML = recentExpenses.map(t => `
          <div class="paper-tx-item" onclick="UI.openTransactionModal('edit', '${t.id}')" title="Klik untuk edit/lihat detail">
            <div class="tx-item-left">
              <span class="tx-item-name">${t.description}</span>
              <span class="tx-item-date">${this.formatDate(t.transaction_date, t.transaction_time)} • ${t.category_name}</span>
            </div>
            <div class="tx-item-right">
              <span class="tx-item-amount tabular-nums">${this.formatIDR(t.amount)}</span>
              <span class="tx-item-status-pill ${t.sync_status === 'pending' ? 'pending' : 'neutral'}">
                ${t.sync_status === 'pending' ? 'Pending' : 'Lunas'}
              </span>
            </div>
          </div>
        `).join('');
      }
    }
  },

  renderQuickActions() {
    const container = document.getElementById('quickActionsBar');
    if (!container) return;

    const settings = window.store.getSettings();
    const actions = settings.quickActions || INITIAL_QUICK_ACTIONS;

    container.innerHTML = actions.map(act => {
      // Strip duplicate leading emoji if already part of act.label
      const rawLabel = act.label || '';
      const cleanLabel = rawLabel.replace(/^[\p{Emoji}\u200d\uFE0F\s]+/u, '').trim() || rawLabel;
      return `
        <button class="quick-action-chip" onclick="UI.handleQuickActionClick('${(act.text || '').replace(/'/g, "\\'")}')">
          <span>${act.icon || '⚡'}</span>
          <span>${cleanLabel}</span>
        </button>
      `;
    }).join('');
  },

  handleQuickActionClick(text) {
    const input = document.getElementById('chatInputField');
    if (input) {
      input.value = text;
      this.handleSendMessage();
    }
  },

  renderChatMessages() {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    const history = window.store.getChatHistory();

    container.innerHTML = history.map(msg => {
      const isUser = msg.sender === 'user';
      const timeStr = new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      // Handle typing / thinking state
      if (msg.isThinking) {
        return `
          <div class="chat-bubble-row ai">
            <div class="chat-avatar">🤖</div>
            <div class="chat-bubble">
              <div class="ai-typing-indicator">
                <span class="pulse-dot"></span>
                <span>${msg.text || 'Menganalisis dengan Gemini AI...'}</span>
              </div>
            </div>
          </div>
        `;
      }

      let previewCardHtml = '';
      if (msg.parsedTx) {
        const tx = msg.parsedTx;
        const isInc = tx.type === 'income';
        const modelBadge = tx.model_badge || (this.parser && this.parser.formatModelBadge ? this.parser.formatModelBadge(tx.parsed_by) : '🤖 Gemini AI');

        if (tx.needs_clarification) {
          previewCardHtml = `
            <div class="clarification-card">
              <span class="clarification-title">🤔 ${tx.clarification_question}</span>
              <div class="clarification-chips">
                <button class="clarify-chip" onclick="UI.clarifyTransaction('${msg.id}', 'Makanan & Minuman', 'cat-exp-1', 'Makan Siang')">🍔 Makan Siang</button>
                <button class="clarify-chip" onclick="UI.clarifyTransaction('${msg.id}', 'Makanan & Minuman', 'cat-exp-1', 'Kopi / Minuman')">☕ Kopi / Es Teh</button>
                <button class="clarify-chip" onclick="UI.clarifyTransaction('${msg.id}', 'Transportasi', 'cat-exp-2', 'Bensin Motor')">⛽ Bensin</button>
                <button class="clarify-chip" onclick="UI.clarifyTransaction('${msg.id}', 'Belanja', 'cat-exp-3', 'Belanja Harian')">🛒 Belanja</button>
                <button class="clarify-chip" onclick="UI.clarifyTransaction('${msg.id}', 'Lainnya', 'cat-exp-8', 'Lain-lain')">📦 Lainnya</button>
              </div>
            </div>
          `;
        } else if (!msg.saved && !msg.cancelled) {
          previewCardHtml = `
            <div class="ai-preview-card">
              <div class="ai-preview-header">
                <span class="badge ${isInc ? 'badge-income' : 'badge-expense'}">
                  ${isInc ? '💰 Pemasukan Terdeteksi' : '💸 Pengeluaran Terdeteksi'}
                </span>
                <span class="badge badge-ai">${modelBadge}</span>
              </div>
              <div class="ai-preview-amount ${tx.type}">
                ${isInc ? '+' : '-'} ${this.formatIDR(tx.amount)}
              </div>
              <div class="ai-preview-details">
                <div class="ai-preview-detail-item">
                  <span class="label">Kategori</span>
                  <span class="val">${tx.category_icon} ${tx.category_name}</span>
                </div>
                <div class="ai-preview-detail-item">
                  <span class="label">Keterangan</span>
                  <span class="val">${tx.description}</span>
                </div>
                <div class="ai-preview-detail-item">
                  <span class="label">Waktu</span>
                  <span class="val">🕒 ${this.formatDate(tx.transaction_date, tx.transaction_time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'))}</span>
                </div>
              </div>
              <div class="ai-confidence-bar">
                <span>Akurasi: ${Math.round((tx.confidence || 0.95) * 100)}%</span>
                <div class="confidence-track">
                  <div class="confidence-fill" style="width: ${Math.round((tx.confidence || 0.95) * 100)}%"></div>
                </div>
              </div>
              <div class="ai-preview-actions">
                <button class="btn btn-sm btn-primary" onclick="UI.confirmParsedTransaction('${msg.id}')">
                  ✅ Simpan Transaksi
                </button>
                <button class="btn btn-sm btn-secondary" onclick="UI.openEditFromChat('${msg.id}')">
                  ✏️ Edit
                </button>
                <button class="btn btn-sm btn-ghost" onclick="UI.cancelParsedTransaction('${msg.id}')">
                  ❌ Batal
                </button>
              </div>
            </div>
          `;
        } else if (msg.saved) {
          if (msg.pending) {
            previewCardHtml = `
              <div style="margin-top: 8px; font-size: 0.8rem; color: var(--warning); font-weight: 600; display: flex; align-items: center; gap: 6px;">
                <span>⏳</span> Tersimpan di antrean offline (Pending). Otomatis disinkronkan saat online.
              </div>
            `;
          } else {
            previewCardHtml = `
              <div style="margin-top: 8px; font-size: 0.8rem; color: var(--income); font-weight: 600; display: flex; align-items: center; gap: 6px;">
                <span>✅</span> Transaksi berhasil dicatat dan disinkronkan ke cloud.
              </div>
            `;
          }
        } else if (msg.cancelled) {
          previewCardHtml = `
            <div style="margin-top: 8px; font-size: 0.8rem; color: var(--text-dim); font-style: italic;">
              Transaksi dibatalkan.
            </div>
          `;
        }
      }

      return `
        <div class="chat-bubble-row ${isUser ? 'user' : 'ai'}">
          <div class="chat-avatar">${isUser ? '👤' : '🤖'}</div>
          <div class="chat-bubble">
            <div>${msg.text}</div>
            ${previewCardHtml}
            <span class="chat-time">${timeStr}</span>
          </div>
        </div>
      `;
    }).join('');

    this.scrollToBottomChat();
  },

  scrollToBottomChat() {
    const container = document.getElementById('chatMessagesContainer');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },

  async handleSendMessage() {
    const input = document.getElementById('chatInputField');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    // 1. Add user message optimistic render
    window.store.addChatMessage({
      sender: 'user',
      text: text
    });

    input.value = '';

    // 2. Add temporary thinking indicator
    const thinkingId = 'msg-thinking-' + Date.now();
    const history = window.store.getChatHistory();
    history.push({
      id: thinkingId,
      sender: 'ai',
      isThinking: true,
      text: 'Menganalisis kalimat dengan Gemini AI Multi-tier...',
      timestamp: new Date().toISOString()
    });
    window.store.saveChatHistory(history);
    this.renderChatMessages();

    // 3. Process with Gemini AI Cascade
    try {
      const parseResult = await this.parser.parse(text);

      // Remove temporary thinking message
      const cleanHistory = window.store.getChatHistory().filter(m => m.id !== thinkingId);
      window.store.saveChatHistory(cleanHistory);

      if (parseResult && parseResult.success) {
        const tx = parseResult.data;
        tx.model_badge = parseResult.model_badge;

        let aiResponseText = `Saya sudah menganalisis kalimat kamu (${tx.model_badge}):`;
        if (tx.needs_clarification) {
          aiResponseText = `Saya mendeteksi nominal ${this.formatIDR(tx.amount)}, tapi butuh sedikit kejelasan:`;
        }

        window.store.addChatMessage({
          sender: 'ai',
          text: aiResponseText,
          parsedTx: tx,
          saved: false
        });
      } else {
        window.store.addChatMessage({
          sender: 'ai',
          text: `Maaf, saya belum bisa memahami: "${text}". Coba masukkan contoh seperti *"beli esteh 2 harga 5k"* atau *"gajian 5jt"*.`
        });
      }
    } catch (err) {
      console.error('AI parse exception:', err);
      // Remove temporary thinking message
      const cleanHistory = window.store.getChatHistory().filter(m => m.id !== thinkingId);
      window.store.saveChatHistory(cleanHistory);

      // Local offline regex fallback
      const fallback = this.parser.parseOfflineRegex(text);
      if (fallback && fallback.success) {
        const tx = fallback.data;
        tx.model_badge = '⚡ Local Fallback';
        window.store.addChatMessage({
          sender: 'ai',
          text: `Layanan AI sedang sibuk, berhasil diproses dengan mesin lokal:`,
          parsedTx: tx,
          saved: false
        });
      } else {
        window.store.addChatMessage({
          sender: 'ai',
          text: `Maaf, terjadi gangguan saat menganalisis "${text}". Coba ulangi kembali.`
        });
      }
    }

    this.renderChatMessages();
  },

  confirmParsedTransaction(msgId) {
    const history = window.store.getChatHistory();
    const msg = history.find(m => m.id === msgId);
    if (!msg || !msg.parsedTx) return;

    const isOffline = window.store.getSettings().isOfflineMode;

    // Add to transactions store
    window.store.addTransaction(msg.parsedTx);
    msg.saved = true;
    msg.pending = isOffline;
    window.store.saveChatHistory(history);

    if (isOffline) {
      this.showToast(`⏳ Disimpan ke antrean offline (Pending). Akan otomatis sinkron saat online!`, 'warning');
    } else {
      this.showToast(`✨ Berhasil mencatat ${msg.parsedTx.type === 'income' ? 'pemasukan' : 'pengeluaran'} ${this.formatIDR(msg.parsedTx.amount)}`, 'success');
    }
    this.renderAll();
  },

  cancelParsedTransaction(msgId) {
    const history = window.store.getChatHistory();
    const msg = history.find(m => m.id === msgId);
    if (!msg) return;

    msg.cancelled = true;
    window.store.saveChatHistory(history);
    this.renderChatMessages();
    this.showToast('Transaksi dibatalkan.', 'info');
  },

  clarifyTransaction(msgId, catName, catId, desc) {
    const history = window.store.getChatHistory();
    const msg = history.find(m => m.id === msgId);
    if (!msg || !msg.parsedTx) return;

    const cat = window.store.getCategories().find(c => c.id === catId) || { icon: '📦' };

    msg.parsedTx.category_name = catName;
    msg.parsedTx.category_id = catId;
    msg.parsedTx.category_icon = cat.icon;
    msg.parsedTx.description = desc;
    msg.parsedTx.needs_clarification = false;
    msg.parsedTx.confidence = 0.94;

    window.store.saveChatHistory(history);
    this.renderChatMessages();
  },

  openEditFromChat(msgId) {
    const history = window.store.getChatHistory();
    const msg = history.find(m => m.id === msgId);
    if (!msg || !msg.parsedTx) return;

    this.openTransactionModal('edit-chat', msg.parsedTx, msgId);
  },

  // TAB 3: Income View
  renderIncomeView() {
    const tableBody = document.getElementById('incomeTableBody');
    const container = tableBody || document.getElementById('incomeTxList');
    if (!container) return;

    let txs = window.store.getTransactions().filter(t => t.type === 'income');

    // Period filter
    const now = new Date();
    txs = txs.filter(t => {
      if (this.incomeFilterPeriod === 'all') return true;
      const tDate = new Date(t.transaction_date);
      const diffDays = Math.floor((now - tDate) / (1000 * 60 * 60 * 24));
      if (this.incomeFilterPeriod === 'today') return diffDays === 0;
      if (this.incomeFilterPeriod === '7d') return diffDays <= 7;
      if (this.incomeFilterPeriod === 'month') {
        return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      }
      return true;
    });

    // Category filter
    if (this.categoryFilterIncome !== 'all') {
      txs = txs.filter(t => t.category_id === this.categoryFilterIncome);
    }

    // Search query
    if (this.searchQueryIncome) {
      const q = this.searchQueryIncome.toLowerCase();
      txs = txs.filter(t =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.category_name || '').toLowerCase().includes(q) ||
        (t.raw_input || '').toLowerCase().includes(q)
      );
    }

    // Sort
    txs.sort((a, b) => {
      if (this.sortIncome === 'date-desc') return new Date(b.transaction_date) - new Date(a.transaction_date);
      if (this.sortIncome === 'date-asc') return new Date(a.transaction_date) - new Date(b.transaction_date);
      if (this.sortIncome === 'amount-desc') return b.amount - a.amount;
      if (this.sortIncome === 'amount-asc') return a.amount - b.amount;
      return 0;
    });

    if (txs.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 36px 20px; color: var(--text-muted);">
            Tidak ada transaksi pemasukan yang cocok.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = txs.map(t => `
      <tr>
        <td style="color: var(--text-muted); font-size: 12px;">${this.formatDate(t.transaction_date, t.transaction_time)}</td>
        <td>
          <div style="font-weight: 600; color: var(--text-heading); font-size: 13.5px;">${t.description}</div>
        </td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; background: var(--bg-hover); padding: 3px 8px; border-radius: 4px;">
            ${t.category_icon || '💰'} ${t.category_name}
          </span>
        </td>
        <td>
          <span class="tx-item-status-pill ${t.sync_status === 'pending' ? 'pending' : 'success'}">
            ${t.sync_status === 'pending' ? 'Pending' : 'Diterima'}
          </span>
        </td>
        <td style="text-align: right; font-weight: 700; color: var(--color-income);" class="tabular-nums">
          +${this.formatIDR(t.amount)}
        </td>
        <td style="text-align: center;">
          <div style="display: inline-flex; gap: 4px;">
            <button class="header-action-btn" style="padding: 3px 7px; font-size: 12px;" onclick="UI.openEditModal('${t.id}')" title="Edit">✏️</button>
            <button class="header-action-btn" style="padding: 3px 7px; font-size: 12px; color: var(--color-expense);" onclick="UI.confirmDeleteTx('${t.id}')" title="Hapus">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  // TAB 4: Expense View
  renderExpenseView() {
    const tableBody = document.getElementById('expenseTableBody');
    const container = tableBody || document.getElementById('expenseTxList');
    if (!container) return;

    let txs = window.store.getTransactions().filter(t => t.type === 'expense');

    // Period filter
    const now = new Date();
    txs = txs.filter(t => {
      if (this.expenseFilterPeriod === 'all') return true;
      const tDate = new Date(t.transaction_date);
      const diffDays = Math.floor((now - tDate) / (1000 * 60 * 60 * 24));
      if (this.expenseFilterPeriod === 'today') return diffDays === 0;
      if (this.expenseFilterPeriod === '7d') return diffDays <= 7;
      if (this.expenseFilterPeriod === 'month') {
        return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      }
      return true;
    });

    // Category filter
    if (this.categoryFilterExpense !== 'all') {
      txs = txs.filter(t => t.category_id === this.categoryFilterExpense);
    }

    // Search query
    if (this.searchQueryExpense) {
      const q = this.searchQueryExpense.toLowerCase();
      txs = txs.filter(t =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.category_name || '').toLowerCase().includes(q) ||
        (t.raw_input || '').toLowerCase().includes(q)
      );
    }

    // Sort
    txs.sort((a, b) => {
      if (this.sortExpense === 'date-desc') return new Date(b.transaction_date) - new Date(a.transaction_date);
      if (this.sortExpense === 'date-asc') return new Date(a.transaction_date) - new Date(b.transaction_date);
      if (this.sortExpense === 'amount-desc') return b.amount - a.amount;
      if (this.sortExpense === 'amount-asc') return a.amount - b.amount;
      return 0;
    });

    if (txs.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 36px 20px; color: var(--text-muted);">
            Tidak ada transaksi pengeluaran yang cocok.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = txs.map(t => `
      <tr>
        <td style="color: var(--text-muted); font-size: 12px;">${this.formatDate(t.transaction_date, t.transaction_time)}</td>
        <td>
          <div style="font-weight: 600; color: var(--text-heading); font-size: 13.5px;">${t.description}</div>
        </td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; background: var(--bg-hover); padding: 3px 8px; border-radius: 4px;">
            ${t.category_icon || '💸'} ${t.category_name}
          </span>
        </td>
        <td>
          <span class="tx-item-status-pill ${t.sync_status === 'pending' ? 'pending' : 'neutral'}">
            ${t.sync_status === 'pending' ? 'Pending' : 'Lunas'}
          </span>
        </td>
        <td style="text-align: right; font-weight: 700; color: var(--color-expense);" class="tabular-nums">
          -${this.formatIDR(t.amount)}
        </td>
        <td style="text-align: center;">
          <div style="display: inline-flex; gap: 4px;">
            <button class="header-action-btn" style="padding: 3px 7px; font-size: 12px;" onclick="UI.openEditModal('${t.id}')" title="Edit">✏️</button>
            <button class="header-action-btn" style="padding: 3px 7px; font-size: 12px; color: var(--color-expense);" onclick="UI.confirmDeleteTx('${t.id}')" title="Hapus">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  renderTop3Categories(txs) {
    const container = document.getElementById('topCategoriesContainer');
    if (!container) return;

    const breakdown = {};
    txs.forEach(t => {
      const cat = t.category_name || 'Lainnya';
      if (!breakdown[cat]) {
        breakdown[cat] = {
          name: cat,
          icon: t.category_icon || '📦',
          total: 0
        };
      }
      breakdown[cat].total += Number(t.amount);
    });

    const top3 = Object.values(breakdown).sort((a, b) => b.total - a.total).slice(0, 3);
    if (top3.length === 0) {
      container.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted);">Belum ada data pengeluaran.</p>`;
      return;
    }

    container.innerHTML = top3.map((cat, idx) => `
      <div class="top-cat-card">
        <div class="top-cat-icon">${cat.icon}</div>
        <div class="top-cat-details">
          <div class="top-cat-name">#${idx + 1} ${cat.name}</div>
          <div class="top-cat-spent">${this.formatIDR(cat.total)}</div>
        </div>
      </div>
    `).join('');
  },

  // TAB 4: Stats View
  renderStatsView() {
    const summary = window.store.getOverallSummary(this.activePeriodFilter);

    // Summary Metric Cards
    const incEl = document.getElementById('statTotalIncome');
    const expEl = document.getElementById('statTotalExpense');
    const balEl = document.getElementById('statTotalBalance');
    const rateEl = document.getElementById('statSavingsRate');

    if (incEl) incEl.textContent = this.formatIDR(summary.totalIncome);
    if (expEl) expEl.textContent = this.formatIDR(summary.totalExpense);
    if (balEl) balEl.textContent = this.formatIDR(summary.balance);
    if (rateEl) rateEl.textContent = `${summary.savingsRatio}%`;

    // Health Score
    const healthDial = document.getElementById('healthScoreVal');
    const healthStatus = document.getElementById('healthScoreStatus');
    const healthTip = document.getElementById('healthScoreTip');

    if (healthDial) healthDial.textContent = summary.healthScore;
    if (healthStatus && healthTip) {
      if (summary.healthScore >= 80) {
        healthStatus.textContent = 'Kondisi Keuangan Prima ✨';
        healthTip.textContent = 'Arus kas surplus dan rasio tabungan kamu sangat sehat!';
      } else if (summary.healthScore >= 50) {
        healthStatus.textContent = 'Kondisi Keuangan Cukup Baik 👍';
        healthTip.textContent = 'Perhatikan pengeluaran impulsif pada pos hiburan & belanja.';
      } else {
        healthStatus.textContent = 'Waspada Defisit Anggaran ⚠️';
        healthTip.textContent = 'Pengeluaran melebihi pemasukan bulan ini, segera rem belanja.';
      }
    }

    // Render Charts
    window.ChartEngine.renderDonutChart('donutChartBox', summary.categoryBreakdown);
    window.ChartEngine.renderBarChart('barChartBox', summary.filteredTransactions);
    window.ChartEngine.renderTrendChart('trendChartBox', summary.filteredTransactions);
  },

  // TAB 5: Settings View
  renderSettingsView() {
    const settings = window.store.getSettings();
    const categories = window.store.getCategories();

    // Toggle switch states
    const offlineSwitch = document.getElementById('offlineModeSwitch');
    if (offlineSwitch) offlineSwitch.checked = !!settings.isOfflineMode;

    const themeSwitch = document.getElementById('darkModeSwitch');
    if (themeSwitch) themeSwitch.checked = settings.theme !== 'light';

    // Populate Gemini API Key input
    const geminiInput = document.getElementById('geminiApiKeyInput');
    if (geminiInput && !geminiInput.dataset.focused) {
      geminiInput.value = window.store.getGeminiApiKey();
    }

    // Populate Wi-Fi URL input
    const wifiInput = document.getElementById('settingsWifiUrlInput');
    if (wifiInput && this.mobileWifiUrl) {
      wifiInput.value = this.mobileWifiUrl;
    }

    // Render Database & Vercel Postgres status
    const dbStatus = window.store.dbStatus;
    const dbBadge = document.getElementById('dbStatusBadge');
    const dbDesc = document.getElementById('dbStatusDescription');
    const dbEngine = document.getElementById('dbEngineText');
    const dbSync = document.getElementById('dbSyncStatsText');

    if (dbStatus) {
      if (dbBadge) {
        if (dbStatus.provider === 'vercel-postgres') {
          dbBadge.style.background = 'var(--color-income-light)';
          dbBadge.style.color = 'var(--color-income)';
          dbBadge.textContent = '🟢 Vercel Postgres (Neon SSL)';
        } else if (dbStatus.provider === 'local-fallback') {
          dbBadge.style.background = 'rgba(245, 158, 11, 0.15)';
          dbBadge.style.color = '#D97706';
          dbBadge.textContent = '🟠 Local Store (Siap Vercel)';
        } else {
          dbBadge.style.background = 'rgba(239, 68, 68, 0.15)';
          dbBadge.style.color = 'var(--color-expense)';
          dbBadge.textContent = '🔴 Offline';
        }
      }

      if (dbDesc) {
        dbDesc.textContent = dbStatus.message || (dbStatus.connected ? 'Database siap dan aktif.' : 'Tidak terhubung.');
      }
      if (dbEngine) {
        dbEngine.textContent = dbStatus.engine || (dbStatus.provider === 'vercel-postgres' ? 'PostgreSQL' : 'Local Store');
      }
      if (dbSync) {
        const pending = window.store.getPendingQueue().length;
        dbSync.textContent = pending > 0 ? `⏳ ${pending} Antrean Pending` : '✅ Sinkron Penuh';
      }
    }

    // Categories list
    const catContainer = document.getElementById('settingsCategoriesCloud');
    if (catContainer) {
      catContainer.innerHTML = categories.map(c => {
        const isLainnya = (c.name || '').toLowerCase() === 'lainnya';
        return `
          <div class="cat-manage-pill">
            <span>${c.icon || '🏷️'}</span>
            <span>${c.name}</span>
            <span style="font-size: 10px; font-weight: 700; opacity: 0.85; color: ${c.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)'}">
              (${c.type === 'income' ? 'Masuk' : 'Keluar'})
            </span>
            ${!isLainnya ? `
              <button onclick="UI.deleteCategory('${c.id}')" title="Hapus kategori ${c.name} (transaksi akan dialihkan ke Lainnya)" class="cat-delete-btn">✕</button>
            ` : '<span style="font-size: 10px; color: var(--text-muted); padding-left: 2px;">(Sistem)</span>'}
          </div>
        `;
      }).join('');
    }
  },

  async refreshDbStatus() {
    this.showToast('Memeriksa koneksi database cloud...', 'info');
    const status = await window.store.refreshDbStatus();
    this.renderSettingsView();
    if (status.connected) {
      this.showToast(`Database aktif: ${status.engine}`, 'success');
    } else {
      this.showToast('Gagal terhubung ke database.', 'error');
    }
  },

  async syncWithCloudNow() {
    const btn = document.getElementById('syncToCloudBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Menyinkronkan...';
    }
    const res = await window.store.syncWithCloud();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 Sinkronkan ke Cloud';
    }
    if (res.success) {
      this.showToast(res.message, 'success');
      this.renderAll();
    } else {
      this.showToast(res.message, 'warning');
    }
  },

  toggleApiKeyVisibility() {
    const input = document.getElementById('geminiApiKeyInput');
    const btn = document.getElementById('toggleApiKeyVisibilityBtn');
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (btn) btn.textContent = '🔒 Sembunyikan';
    } else {
      input.type = 'password';
      if (btn) btn.textContent = '👁️ Tampilkan';
    }
  },

  saveGeminiApiKey() {
    const input = document.getElementById('geminiApiKeyInput');
    if (!input) return;
    const key = input.value.trim();
    if (!key) {
      this.showToast('API Key tidak boleh kosong.', 'warning');
      return;
    }
    window.store.setGeminiApiKey(key);
    this.showToast('Google AI Studio API Key berhasil disimpan!', 'success');
  },

  async testGeminiConnection() {
    const input = document.getElementById('geminiApiKeyInput');
    const key = input ? input.value.trim() : window.store.getGeminiApiKey();
    const resultBox = document.getElementById('geminiTestResultBox');
    const btn = document.getElementById('testGeminiBtn');

    if (!key && !this.serverHasGeminiKey) {
      this.showToast('Masukkan Google AI Studio API Key atau aktifkan di server .env.', 'warning');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Menguji...';
    }

    if (resultBox) {
      resultBox.style.display = 'block';
      resultBox.style.background = 'rgba(59, 130, 246, 0.1)';
      resultBox.style.border = '1px solid rgba(59, 130, 246, 0.3)';
      resultBox.style.color = 'var(--text-primary)';
      resultBox.innerHTML = '<span>⏳ Menghubungi Google AI Studio & menguji cascade model...</span>';
    }

    const start = Date.now();
    try {
      let success = false;
      let modelUsed = '';
      let latency = 0;

      // 1. Try server bridge /api/test-gemini
      try {
        const res = await fetch('/api/test-gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: key })
        });
        const json = await res.json();
        if (json.success) {
          success = true;
          modelUsed = json.activeModel;
          latency = json.latencyMs;
        }
      } catch (err) {
        // Fallback to direct client ping
        try {
          const directRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'ping' }] }],
              generationConfig: { maxOutputTokens: 5 }
            })
          });
          if (directRes.ok) {
            success = true;
            modelUsed = 'gemini-flash-lite-latest';
            latency = Date.now() - start;
          }
        } catch (directErr) {
          console.error(directErr);
        }
      }

      if (success) {
        if (resultBox) {
          resultBox.style.background = 'rgba(16, 185, 129, 0.12)';
          resultBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
          resultBox.style.color = 'var(--income)';
          resultBox.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px;">✅ Koneksi Berhasil Terverifikasi!</div>
            <div>Model Terhubung: <code style="font-weight: 600; color: var(--primary);">${modelUsed}</code> • Latensi: <strong>${latency}ms</strong></div>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 4px;">Google AI Studio siap memproses input transaksi alami dengan Adaptive Fallback Cascade.</div>
          `;
        }
        const badge = document.getElementById('geminiConnectionBadge');
        if (badge) {
          badge.textContent = `🟢 Gemini Aktif (${latency}ms)`;
        }
        this.showToast(`Koneksi Google AI Studio Sukses (${latency}ms)!`, 'success');
      } else {
        if (resultBox) {
          resultBox.style.background = 'rgba(239, 68, 68, 0.12)';
          resultBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
          resultBox.style.color = 'var(--expense)';
          resultBox.innerHTML = `
            <div style="font-weight: 700;">❌ Gagal Terhubung ke Google AI Studio</div>
            <div style="margin-top: 4px;">Pastikan API Key valid atau kuota AI Studio tersedia.</div>
          `;
        }
        this.showToast('Gagal terhubung ke Google AI Studio.', 'error');
      }
    } catch (e) {
      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.style.background = 'rgba(239, 68, 68, 0.12)';
        resultBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        resultBox.style.color = 'var(--expense)';
        resultBox.innerHTML = `<strong>Error:</strong> ${e.message}`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '⚡ Test Koneksi';
      }
    }
  },

  openAddCategoryModal() {
    const modal = document.getElementById('categoryModal');
    if (modal) {
      const nameInput = document.getElementById('newCatName');
      const iconInput = document.getElementById('newCatIcon');
      if (nameInput) nameInput.value = '';
      if (iconInput) iconInput.value = '';
      modal.classList.add('active');
      if (nameInput) setTimeout(() => nameInput.focus(), 80);
    }
  },

  closeAddCategoryModal() {
    const modal = document.getElementById('categoryModal');
    if (modal) modal.classList.remove('active');
  },

  deleteCategory(catId) {
    const cat = window.store.getCategories().find(c => c.id === catId);
    if (!cat) return;

    if ((cat.name || '').toLowerCase() === 'lainnya') {
      this.showToast('Kategori "Lainnya" adalah kategori sistem dan tidak dapat dihapus.', 'warning');
      return;
    }

    const confirmed = confirm(
      `Hapus kategori "${cat.name}"?\n\nSemua transaksi dengan kategori "${cat.name}" di riwayat transaksi akan otomatis dialihkan ke kategori "Lainnya".`
    );
    if (!confirmed) return;

    const res = window.store.deleteCategory(catId);
    if (res && res.success) {
      if (res.reassignedCount > 0) {
        this.showToast(`Kategori "${cat.name}" dihapus. ${res.reassignedCount} transaksi dialihkan ke "Lainnya".`, 'info');
      } else {
        this.showToast(`Kategori "${cat.name}" berhasil dihapus.`, 'info');
      }
      this.renderAll();
    } else {
      this.showToast(res ? res.message : 'Gagal menghapus kategori.', 'warning');
    }
  },

  // Category Selects in Modals & Filters
  populateCategorySelects() {
    const categories = window.store.getCategories();

    const incomeFilter = document.getElementById('incomeCategoryFilter');
    if (incomeFilter) {
      const incCats = categories.filter(c => c.type === 'income');
      incomeFilter.innerHTML = `<option value="all">Semua Kategori</option>` +
        incCats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
      incomeFilter.value = this.categoryFilterIncome;
    }

    const expenseFilter = document.getElementById('expenseCategoryFilter');
    if (expenseFilter) {
      const expCats = categories.filter(c => c.type === 'expense');
      expenseFilter.innerHTML = `<option value="all">Semua Kategori</option>` +
        expCats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
      expenseFilter.value = this.categoryFilterExpense;
    }
  },

  // Modal Handlers
  openTransactionModal(mode = 'add', data = null, preferredTypeOrChatId = null) {
    const modal = document.getElementById('transactionModal');
    if (!modal) return;

    this.currentEditingTxId = data ? data.id : null;
    const isExplicitType = preferredTypeOrChatId === 'income' || preferredTypeOrChatId === 'expense';
    this.currentChatMsgId = isExplicitType ? null : preferredTypeOrChatId;

    const modalTitle = document.getElementById('txModalTitle');
    const typeSelect = document.getElementById('txModalType');
    const amountInput = document.getElementById('txModalAmount');
    const descInput = document.getElementById('txModalDesc');
    const dateInput = document.getElementById('txModalDate');
    const timeInput = document.getElementById('txModalTime');
    const catSelect = document.getElementById('txModalCategory');

    modalTitle.textContent = mode === 'edit' || mode === 'edit-chat' ? 'Edit Transaksi' : 'Catat Transaksi';

    const defaultTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

    if (data) {
      typeSelect.value = data.type || 'expense';
      amountInput.value = data.amount || '';
      descInput.value = data.description || '';
      dateInput.value = data.transaction_date || new Date().toISOString().split('T')[0];
      if (timeInput) timeInput.value = data.transaction_time || defaultTime;
    } else {
      if (isExplicitType) {
        typeSelect.value = preferredTypeOrChatId;
      } else {
        typeSelect.value = this.activeTab === 'income' ? 'income' : 'expense';
      }
      amountInput.value = '';
      descInput.value = '';
      dateInput.value = new Date().toISOString().split('T')[0];
      if (timeInput) timeInput.value = defaultTime;
    }

    this.updateCategoryOptionsInModal(typeSelect.value, data ? data.category_id : null);

    typeSelect.onchange = () => {
      this.updateCategoryOptionsInModal(typeSelect.value);
    };

    modal.classList.add('active');
  },

  updateCategoryOptionsInModal(type, selectedCatId = null) {
    const catSelect = document.getElementById('txModalCategory');
    if (!catSelect) return;
    const cats = window.store.getCategories().filter(c => c.type === type);
    catSelect.innerHTML = cats.map(c => `
      <option value="${c.id}" ${c.id === selectedCatId ? 'selected' : ''}>${c.icon} ${c.name}</option>
    `).join('');
  },

  closeTransactionModal() {
    const modal = document.getElementById('transactionModal');
    if (modal) modal.classList.remove('active');
    this.currentEditingTxId = null;
    this.currentChatMsgId = null;
  },

  saveTransactionFromModal() {
    const type = document.getElementById('txModalType').value;
    const amount = parseFloat(document.getElementById('txModalAmount').value);
    const desc = document.getElementById('txModalDesc').value.trim();
    const date = document.getElementById('txModalDate').value;
    const timeInput = document.getElementById('txModalTime');
    const time = (timeInput && timeInput.value)
      ? timeInput.value
      : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    const catId = document.getElementById('txModalCategory').value;

    if (!amount || amount <= 0) {
      alert('Masukkan nominal yang valid.');
      return;
    }

    const cat = window.store.getCategories().find(c => c.id === catId) || { name: 'Lainnya', icon: '📦' };

    const payload = {
      type,
      amount,
      description: desc || (type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
      category_id: catId,
      category_name: cat.name,
      category_icon: cat.icon,
      transaction_date: date,
      transaction_time: time
    };

    if (this.currentChatMsgId) {
      // Updated from chat bubble preview
      const history = window.store.getChatHistory();
      const msg = history.find(m => m.id === this.currentChatMsgId);
      if (msg && msg.parsedTx) {
        msg.parsedTx = { ...msg.parsedTx, ...payload };
        window.store.saveChatHistory(history);
      }
      this.showToast('Perubahan transaksi tersimpan di chat.', 'info');
    } else if (this.currentEditingTxId) {
      // Edit existing transaction
      window.store.updateTransaction(this.currentEditingTxId, payload);
      this.showToast('Transaksi berhasil diperbarui.', 'success');
    } else {
      // Add new transaction
      const isOffline = window.store.getSettings().isOfflineMode;
      window.store.addTransaction(payload);
      if (isOffline) {
        this.showToast('⏳ Disimpan ke antrean offline (Pending). Akan otomatis sinkron saat online!', 'warning');
      } else {
        this.showToast('Transaksi baru berhasil ditambahkan.', 'success');
      }
    }

    this.closeTransactionModal();
    this.renderAll();
  },

  openEditModal(txId) {
    const tx = window.store.getTransactions().find(t => t.id === txId);
    if (tx) {
      this.openTransactionModal('edit', tx);
    }
  },

  confirmDeleteTx(txId) {
    if (confirm('Yakin ingin menghapus transaksi ini?')) {
      window.store.deleteTransaction(txId);
      this.showToast('Transaksi dihapus.', 'info');
      this.renderAll();
    }
  },

  // Toast Notification System
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  // Event bindings
  bindEvents() {
    // Navigation Tabs (Sidebar, Desktop & Mobile Bottom Bar)
    document.querySelectorAll('.sidebar-nav-item, .mobile-nav-btn, .nav-tab-btn, .bottom-tab-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });

    // Chat input Enter key
    const chatInput = document.getElementById('chatInputField');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    // Chat Send Button
    const sendBtn = document.getElementById('chatSendBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.handleSendMessage());
    }

    // Period filter pills for Stats
    document.querySelectorAll('.stats-period-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.stats-period-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activePeriodFilter = pill.getAttribute('data-period') || 'all';
        this.renderStatsView();
      });
    });

    // Income filters
    document.querySelectorAll('.income-period-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.income-period-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.incomeFilterPeriod = pill.getAttribute('data-period') || 'all';
        this.renderIncomeView();
      });
    });

    const incSearch = document.getElementById('incomeSearchInput');
    if (incSearch) {
      incSearch.addEventListener('input', (e) => {
        this.searchQueryIncome = e.target.value;
        this.renderIncomeView();
      });
    }

    const incCatSelect = document.getElementById('incomeCategoryFilter');
    if (incCatSelect) {
      incCatSelect.addEventListener('change', (e) => {
        this.categoryFilterIncome = e.target.value;
        this.renderIncomeView();
      });
    }

    const incSort = document.getElementById('incomeSortSelect');
    if (incSort) {
      incSort.addEventListener('change', (e) => {
        this.sortIncome = e.target.value;
        this.renderIncomeView();
      });
    }

    // Expense filters
    document.querySelectorAll('.expense-period-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.expense-period-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.expenseFilterPeriod = pill.getAttribute('data-period') || 'all';
        this.renderExpenseView();
      });
    });

    const expSearch = document.getElementById('expenseSearchInput');
    if (expSearch) {
      expSearch.addEventListener('input', (e) => {
        this.searchQueryExpense = e.target.value;
        this.renderExpenseView();
      });
    }

    const expCatSelect = document.getElementById('expenseCategoryFilter');
    if (expCatSelect) {
      expCatSelect.addEventListener('change', (e) => {
        this.categoryFilterExpense = e.target.value;
        this.renderExpenseView();
      });
    }

    const expSort = document.getElementById('expenseSortSelect');
    if (expSort) {
      expSort.addEventListener('change', (e) => {
        this.sortExpense = e.target.value;
        this.renderExpenseView();
      });
    }

    // Header sync indicator toggle
    const syncIndicator = document.getElementById('syncStatusIndicator');
    if (syncIndicator) {
      syncIndicator.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleOfflineSimulator();
      });
    }

    // Settings offline switch
    const offlineSwitch = document.getElementById('offlineModeSwitch');
    if (offlineSwitch) {
      offlineSwitch.addEventListener('change', (e) => {
        this.handleNetworkStatusChange(!e.target.checked);
      });
    }

    // Real Browser Network Online/Offline Listeners
    window.addEventListener('online', () => {
      this.handleNetworkStatusChange(true);
    });

    window.addEventListener('offline', () => {
      this.handleNetworkStatusChange(false);
    });

    // Automatic background check: syncs immediately if online and pending items exist
    setInterval(() => {
      const settings = window.store.getSettings();
      const queue = window.store.getPendingQueue();
      if (!settings.isOfflineMode && navigator.onLine && queue.length > 0) {
        this.autoSync();
      }
    }, 2500);

    // Settings dark mode switch
    const themeSwitch = document.getElementById('darkModeSwitch');
    if (themeSwitch) {
      themeSwitch.addEventListener('change', (e) => {
        const theme = e.target.checked ? 'dark' : 'light';
        window.store.updateSettings({ theme });
      });
    }
  }
};

window.UI = UI;
