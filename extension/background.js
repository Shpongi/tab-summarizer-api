// שומר כתובת API בזיכרון ברירת מחדל (אפשר לשנות מה-popup)
const DEFAULT_API_URL = "https://tab-summarizer-api.vercel.app/api/tabs";

// הודעות מה-popup
chrome.runtime.onMessage.addListener(async (msg, _sender, sendResponse) => {
  if (msg.type === "SEND_TABS") {
    try {
      const apiUrl = (await chrome.storage.sync.get(["apiUrl"])).apiUrl || DEFAULT_API_URL;
      const apiKey = (await chrome.storage.sync.get(["apiKey"])).apiKey || "";

      const tabs = msg.scope === "current"
        ? await chrome.tabs.query({ active: true, currentWindow: true })
        : await chrome.tabs.query({}); // כל הטאבים

      const data = tabs.map(t => ({ title: t.title, url: t.url }));

      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, tabs: data })
      });

      const json = await resp.json();
      sendResponse({ ok: true, result: json });
    } catch (err) {
      console.error(err);
      sendResponse({ ok: false, error: String(err) });
    }
    // Important for async sendResponse
    return true;
  }
});
