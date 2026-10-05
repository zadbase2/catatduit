const db = require('../db');
const { MODEL_CASCADE } = require('../api-handlers');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const hasKey = !!process.env.GEMINI_API_KEY;

  try {
    const dbStatus = await db.getDbStatus();
    return res.status(200).json({
      status: 'ok',
      hasGeminiKey: hasKey,
      models: MODEL_CASCADE,
      database: {
        connected: dbStatus.connected,
        provider: dbStatus.provider,
        engine: dbStatus.engine
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
