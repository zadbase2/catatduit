const { handlers } = require('../api-handlers');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'GET') {
      const result = await handlers.getTransactions(req.query || {});
      return res.status(result.status).json(result.body);
    }

    if (req.method === 'POST') {
      const result = await handlers.createTransaction(req.body);
      return res.status(result.status).json(result.body);
    }

    if (req.method === 'PUT') {
      const id = (req.query && req.query.id) || (req.body && req.body.id);
      const result = await handlers.updateTransaction(id, req.body);
      return res.status(result.status).json(result.body);
    }

    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) || (req.body && req.body.id);
      const result = await handlers.deleteTransaction(id);
      return res.status(result.status).json(result.body);
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
