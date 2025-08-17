// פונקציה מינימלית שעובדת עם @vercel/node (CommonJS)
module.exports = async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      ok: true,
      route: '/api/tabs',
      method: req.method,
      now: new Date().toISOString()
    });
  } catch (e) {
    console.error('tabs.js error:', e);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
};
