/**
 * CatatDuit - Sample Data & Initial Categories
 * Based on PRD section 4.3
 */

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

const INITIAL_QUICK_ACTIONS = [
  { id: 'qa-1', label: 'Es Kopi Susu', text: 'beli es kopi susu 18k', icon: '☕' },
  { id: 'qa-2', label: 'Makan Padang', text: 'makan siang nasi padang 28rb', icon: '🍚' },
  { id: 'qa-3', label: 'Pertalite', text: 'isi bensin pertalite 30k', icon: '⛽' },
  { id: 'qa-4', label: 'Token Listrik', text: 'bayar token pln 200rb', icon: '💡' },
  { id: 'qa-5', label: 'Freelance Web', text: 'dapet transfer freelance 1.5jt', icon: '💻' }
];

function getSampleTransactions() {
  const now = new Date();
  const formatD = (offsetDays) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().split('T')[0];
  };

  return [
    {
      id: 'tx-1',
      type: 'income',
      amount: 8500000,
      category_id: 'cat-inc-1',
      category_name: 'Gaji',
      category_icon: '💰',
      description: 'Gaji Bulanan Oktober',
      raw_input: 'gajian bulan ini 8.5jt',
      ai_confidence: 0.98,
      transaction_date: formatD(0), // today
      transaction_time: '09:00',
      sync_status: 'synced',
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'tx-2',
      type: 'expense',
      amount: 10000,
      category_id: 'cat-exp-1',
      category_name: 'Makanan & Minuman',
      category_icon: '🍔',
      description: 'Esteh Jumbo x2',
      raw_input: 'baru beli esteh 2 harga 5k',
      ai_confidence: 0.95,
      transaction_date: formatD(0), // today
      transaction_time: '11:30',
      sync_status: 'synced',
      created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'tx-3',
      type: 'expense',
      amount: 28000,
      category_id: 'cat-exp-1',
      category_name: 'Makanan & Minuman',
      category_icon: '🍔',
      description: 'Makan Siang Nasi Padang Komplit',
      raw_input: 'makan siang nasi padang 28rb',
      ai_confidence: 0.94,
      transaction_date: formatD(0), // today
      transaction_time: '12:45',
      sync_status: 'synced',
      created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString()
    },
    {
      id: 'tx-4',
      type: 'expense',
      amount: 35000,
      category_id: 'cat-exp-2',
      category_name: 'Transportasi',
      category_icon: '🚗',
      description: 'Isi Bensin Pertamax Motor',
      raw_input: 'isi bensin pertamax 35k',
      ai_confidence: 0.96,
      transaction_date: formatD(1), // yesterday
      transaction_time: '14:20',
      sync_status: 'synced',
      created_at: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'tx-5',
      type: 'expense',
      amount: 385000,
      category_id: 'cat-exp-5',
      category_name: 'Tagihan & Utilitas',
      category_icon: '💡',
      description: 'Tagihan WiFi IndiHome Bulanan',
      raw_input: 'bayar wifi indihome 385rb',
      ai_confidence: 0.97,
      transaction_date: formatD(2),
      transaction_time: '16:15',
      sync_status: 'synced',
      created_at: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'tx-6',
      type: 'income',
      amount: 1750000,
      category_id: 'cat-inc-2',
      category_name: 'Freelance',
      category_icon: '💻',
      description: 'DP Proyek Desain UI Mobile',
      raw_input: 'dapet transferan freelance ui 1.75jt',
      ai_confidence: 0.93,
      transaction_date: formatD(3),
      transaction_time: '10:00',
      sync_status: 'synced',
      created_at: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'tx-7',
      type: 'expense',
      amount: 145000,
      category_id: 'cat-exp-3',
      category_name: 'Belanja',
      category_icon: '🛒',
      description: 'Belanja Mingguan Indomaret',
      raw_input: 'belanja sabun odol cemilan indomaret 145k',
      ai_confidence: 0.91,
      transaction_date: formatD(4),
      transaction_time: '18:50',
      sync_status: 'synced',
      created_at: new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'tx-8',
      type: 'expense',
      amount: 75000,
      category_id: 'cat-exp-4',
      category_name: 'Hiburan',
      category_icon: '🎮',
      description: 'Tiket Bioskop XXI Cinema',
      raw_input: 'nonton bioskop xxi 75rb',
      ai_confidence: 0.95,
      transaction_date: formatD(5),
      transaction_time: '19:30',
      sync_status: 'synced',
      created_at: new Date(now.getTime() - 120 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'tx-9',
      type: 'expense',
      amount: 45000,
      category_id: 'cat-exp-6',
      category_name: 'Kesehatan',
      category_icon: '💊',
      description: 'Beli Vitamin C & Obat Flu',
      raw_input: 'beli vitamin c di apotek 45k',
      ai_confidence: 0.92,
      transaction_date: formatD(6),
      transaction_time: '15:10',
      sync_status: 'synced',
      created_at: new Date(now.getTime() - 144 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'tx-10',
      type: 'income',
      amount: 320000,
      category_id: 'cat-inc-3',
      category_name: 'Investasi',
      category_icon: '📈',
      description: 'Dividen Reksadana Pasar Uang',
      raw_input: 'cair dividen reksadana 320rb',
      ai_confidence: 0.96,
      transaction_date: formatD(7),
      transaction_time: '08:45',
      sync_status: 'synced',
      created_at: new Date(now.getTime() - 168 * 60 * 60 * 1000).toISOString()
    }
  ];
}
