/**
 * CatatDuit - Main Application Initializer
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI and Store
  window.UI.init();

  // Setup Add Category Modal handlers
  const openAddCatBtn = document.getElementById('openAddCategoryModalBtn');
  if (openAddCatBtn) {
    openAddCatBtn.addEventListener('click', () => {
      const modal = document.getElementById('categoryModal');
      if (modal) modal.classList.add('active');
    });
  }

  const saveCatBtn = document.getElementById('saveCategoryBtn');
  if (saveCatBtn) {
    saveCatBtn.addEventListener('click', () => {
      const name = document.getElementById('newCatName').value.trim();
      const type = document.getElementById('newCatType').value;
      const icon = document.getElementById('newCatIcon').value.trim() || '🏷️';
      const color = document.getElementById('newCatColor').value || '#3B82F6';

      if (!name) {
        alert('Nama kategori tidak boleh kosong.');
        return;
      }

      window.store.addCategory({ name, type, icon, color });
      window.UI.showToast(`Kategori "${name}" berhasil ditambahkan!`, 'success');

      // Clear & close
      document.getElementById('newCatName').value = '';
      const modal = document.getElementById('categoryModal');
      if (modal) modal.classList.remove('active');
      window.UI.renderAll();
    });
  }

  // Global ESC key to close any modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
  });

  console.log('🚀 CatatDuit Frontend initialized successfully with Indonesian AI Chatbot & Offline Sync!');
});

// Global functions for inline HTML event handlers
window.openAddCategoryModal = function() {
  if (window.UI && window.UI.openAddCategoryModal) {
    window.UI.openAddCategoryModal();
  } else {
    const modal = document.getElementById('categoryModal');
    if (modal) modal.classList.add('active');
  }
};

window.closeAddCategoryModal = function() {
  if (window.UI && window.UI.closeAddCategoryModal) {
    window.UI.closeAddCategoryModal();
  } else {
    const modal = document.getElementById('categoryModal');
    if (modal) modal.classList.remove('active');
  }
};

window.exportDataCSV = function() {
  window.store.exportCSV();
  window.UI.showToast('File CSV berhasil diunduh!', 'success');
};

window.exportDataJSON = function() {
  window.store.exportJSON();
  window.UI.showToast('Backup JSON berhasil diunduh!', 'success');
};

window.loadSampleData = function() {
  if (confirm('Muat ulang data contoh transaksi realistis?')) {
    window.store.loadSampleData();
    window.UI.showToast('Data contoh berhasil dimuat!', 'success');
  }
};

window.resetAllData = function() {
  if (confirm('PERINGATAN: Semua riwayat transaksi dan antrean akan dihapus permanen. Lanjutkan?')) {
    window.store.clearAllData();
    window.UI.showToast('Semua data berhasil dibersihkan.', 'warning');
  }
};
