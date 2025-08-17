const DEFAULT_API_URL = "https://tab-summarizer-api.vercel.app/api/tabs";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // נחזיר true כדי להשאיר את ה-port פתוח לתשובה אסינכרונית
  (async () => {
    try {
      if (msg.type !== "SEND_TABS") {
        sendResponse({ ok: false, error: "unknown message" });
        return;
      }

      const { apiUrl: storedUrl, apiKey } = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
      const apiUrl = (storedUrl || DEFAULT_API_URL).trim();

      const tabs = msg.scope === "current"
        ? await chrome.tabs.query({ active: true, currentWindow: true })
        : await chrome.tabs.query({});

      const payload = {
        api_key: (apiKey || "").trim(),
        tabs: tabs.map(t => ({ title: t.title, url: t.url }))
      };

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json().catch(() => ({}));
      sendResponse({ ok: res.ok, status: res.status, result: json });

    } catch (err) {
      console.error("SEND_TABS error:", err);
      // נוודא שתמיד מחזירים תשובה
      sendResponse({ ok: false, error: String(err) });
    }
  })();

  return true; // חשוב!
});
