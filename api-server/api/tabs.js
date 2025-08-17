function setCors(res, origin) {
  // רשימת Origins מותרים
  const allowedOrigins = new Set([
    'chrome-extension://akkpkhojallemdmghghnnbmjedpnpkmo', // ה-ID של ההרחבה שלך
    'http://localhost:3000', // אופציונלי לפיתוח
    'https://tab-summarizer-api.vercel.app' // ה-API עצמו
  ]);

  // אם ה-origin שהתקבל נמצא ברשימה — נשתמש בו, אחרת נ fallback ל-no CORS
  const corsOrigin = allowedOrigins.has(origin) ? origin : '*';

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // cache preflight ליום
}

module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    setCors(res, origin);

    if (req.method === 'OPTIONS') {
      return res.status(204).end(); // תשובה ל-preflight
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        route: '/api/tabs',
        method: 'GET',
        now: new Date().toISOString(),
      });
    }

    if (req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');

      const { api_key, tabs } = body;

      if (!api_key || !Array.isArray(tabs)) {
        return res.status(400).json({ ok: false, error: 'Missing api_key or tabs[]' });
      }

      return res.status(200).json({ ok: true, received: tabs.length });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('tabs.js error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
};
