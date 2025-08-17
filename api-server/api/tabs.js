if (req.method === 'POST') {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');

  const { api_key, tabs } = body;

  // תמיד ודא שמגיע מערך tabs
  if (!Array.isArray(tabs)) {
    return res.status(400).json({ ok: false, error: 'tabs[] is required (array)' });
  }

  // אם יש USER_API_KEY בסביבה – דרוש התאמה, אחרת אל תכפה api_key
  if (process.env.USER_API_KEY && api_key !== process.env.USER_API_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized (bad api_key)' });
  }

  return res.status(200).json({ ok: true, received: tabs.length, sample: tabs.slice(0, 3) });
}
