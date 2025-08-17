module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, route: '/api/tabs', method: 'GET', now: new Date().toISOString() });
    }

    if (req.method === 'POST') {
      // קריאת גוף הבקשה (בלי ספריות)
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');

      const { api_key, tabs } = body;
      if (!api_key || !Array.isArray(tabs)) {
        return res.status(400).json({ ok: false, error: 'Missing api_key or tabs[]' });
      }

      // TODO: אימות מפתח (בדוגמה: בדיקה פשוטה מול משתנה סביבה)
      if (process.env.USER_API_KEY && api_key !== process.env.USER_API_KEY) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      // כאן תריץ לוגיקה: cache, סיכום, שליחה לטלגרם וכו׳
      // כרגע נחזיר echo:
      return res.status(200).json({ ok: true, received: tabs.length, sample: tabs.slice(0, 3) });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    console.error('tabs.js error:', e);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
};
