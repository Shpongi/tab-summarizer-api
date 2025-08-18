/* global chrome */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SEND_TABS") {
    handleSend(msg).then(sendResponse).catch(err => {
      console.error("handleSend error:", err);
      sendResponse({ ok: false, error: String(err) });
    });
    return true; // async
  }
});

async function handleSend({ scope, apiBase }) {
  const query = scope === "current" ? { active: true, currentWindow: true } : { currentWindow: true };
  const tabs = await chrome.tabs.query(query);

  const items = tabs
    .map(t => ({ url: t.url, title: t.title }))
    .filter(x => x.url && x.url.startsWith("http"));

  const endpoint = apiBase.replace(/\/$/, "") + "/api/describe-and-send";
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items })
  });

  const text = await resp.text();
  if (!resp.ok) return { ok: false, status: resp.status, raw: text };

  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  const sent = Number(json?.sent ?? 0);
  return { ok: true, sent };
}
