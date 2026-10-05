const { handlers } = require('../api-handlers');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const defaultKey = process.env.GEMINI_API_KEY || '';

  try {
    const body = req.method === 'POST' ? req.body : {};
    const result = await handlers.testGemini(body || {}, defaultKey);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
