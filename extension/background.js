const DEFAULT_API_URL = "https://tab-summarizer-api.vercel.app/api/tabs";

// עטיפות Promise ל־chrome APIs (MV3)
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
}
function tabsQuery(query) {
  return new Promise((resolve) => chrome.tabs.query(query, resolve));
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type !== "SEND_TABS") {
        sendResponse({ ok: false, error: "unknown message" });
        return;
      }

      const { apiUrl, apiKey } = await storageGet(["apiUrl", "apiKey"]);
      const targetUrl = (apiUrl || DEFAULT_API_URL).trim();

      const tabs = msg.scope === "current"
        ? await tabsQuery({ active: true, currentWindow: true })
        : await tabsQuery({}); // כל הטאבים

      const payload = {
        api_key: (apiKey || "").trim(),
        tabs: tabs.map(t => ({ title: t.title, url: t.url }))
      };

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let json = null;
      try { json = await res.json(); } catch { json = {}; }

      sendResponse({ ok: res.ok, status: res.status, result: json });
    } catch (err) {
      console.error("SEND_TABS error:", err);
      sendResponse({ ok: false, error: String(err) });
    }
  })();

  return true; // משאיר את ה-port פתוח עד sendResponse
});
