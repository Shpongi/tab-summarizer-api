function setCors(res, origin) {
  const allowedOrigins = new Set([
    'chrome-extension://akkpkhojallemdmghghnnbmjedpnpkmo',
    'http://localhost:3000',
    'https://tab-summarizer-api.vercel.app'
  ]);
  const corsOrigin = allowedOrigins.has(origin) ? origin : '*';
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString() || '';
  try {
    return { raw, json: raw ? JSON.parse(raw) : {} };
  } catch (e) {
    return { raw, json: null, parseError: String(e) };
  }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  setCors(res, origin);

  try {
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        route: '/api/tabs',
        method: 'GET',
        now: new Date().toISOString()
      });
    }

    if (req.method === 'POST') {
      const { raw, json, parseError } = await readJsonBody(req);

      if (parseError || json === null) {
        console.error('[tabs] JSON parse error:', parseError, 'raw=', raw.slice(0, 500));
        return res.status(400).json({ ok: false, error: 'Bad JSON', details: parseError });
      }

      const { api_key, tabs } = json;

      // ודא שיש מערך tabs
      if (!Array.isArray(tabs)) {
        console.error('[tabs] tabs is not array. body=', json);
        return res.status(400).json({ ok: false, error: 'tabs[] is required (array)' });
      }

      // אימות API KEY אם הוגדר ב־ENV
      const expectedKey = process.env.USER_API_KEY;
      if (expectedKey && api_key !== expectedKey) {
        console.warn('[tabs] Unauthorized api_key. got=', api_key ? '<present>' : '<missing>');
        return res.status(401).json({ ok: false, error: 'Unauthorized (bad api_key)' });
      }

      // OK
      return res.status(200).json({
        ok: true,
        received: tabs.length,
        sample: tabs.slice(0, 3)
      });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[tabs] unhandled error:', err);
    // אל תחזיר גוף ריק – תמיד איזה פירוט בסיסי
    return res.status(500).json({ ok: false, error: 'Internal error', message: String(err) });
  }
};
