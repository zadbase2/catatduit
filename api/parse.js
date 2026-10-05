const { handlers } = require('../api-handlers');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const defaultKey = process.env.GEMINI_API_KEY || '';

  try {
    if (req.method === 'POST') {
      const result = await handlers.parseTransaction(req.body, defaultKey);
      return res.status(result.status).json(result.body);
    }
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
