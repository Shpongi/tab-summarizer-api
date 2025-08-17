// background.js (MV3)

// ==== קונפיג ברירת מחדל ====
const DEFAULT_API_URL = "https://tab-summarizer-api.vercel.app/api/tabs";
const REQUEST_TIMEOUT_MS = 20000; // 20s

// ==== עטיפות Promise ל־Chrome APIs (כי MV3 לא תמיד מחזיר Promise) ====
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.sync.set(obj, resolve));
}
function tabsQuery(query) {
  return new Promise((resolve) => chrome.tabs.query(query, resolve));
}
function tabsRemove(tabIds) {
  return new Promise((resolve) => chrome.tabs.remove(tabIds, resolve));
}

// ==== עוזר: fetch עם timeout ====
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ==== בניית ה־payload לשליחה ====
async function buildPayload(scope) {
  const { apiUrl, apiKey, closeAfterSend } = await storageGet([
    "apiUrl",
    "apiKey",
    "closeAfterSend",
  ]);

  const targetUrl = (apiUrl || DEFAULT_API_URL).trim();
  const key = (apiKey || "").trim();

  const tabs =
    scope === "current"
      ? await tabsQuery({ active: true, currentWindow: true })
      : await tabsQuery({}); // כל הטאבים

  const data = tabs.map((t) => ({ title: t.title || "", url: t.url || "" }));

  return { targetUrl, key, data, tabsRaw: tabs, closeAfterSend: !!closeAfterSend };
}

// ==== שליחה לשרת ====
async function sendTabs(scope) {
  const { targetUrl, key, data, tabsRaw, closeAfterSend } = await buildPayload(scope);

  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    throw new Error("API URL is empty/invalid. Set it in the popup and Save.");
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No tabs to send.");
  }

  const payload = { api_key: key, tabs: data };

  const res = await fetchWithTimeout(
    targetUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    REQUEST_TIMEOUT_MS
  );

  const raw = await res.text();
  let json = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    // נשאיר json ריק; raw יכיל את הטקסט המקורי
  }

  if (!res.ok) {
    const msg =
      json?.error ||
      `HTTP ${res.status}${raw ? ` – ${raw.slice(0, 200)}` : ""}`;
    throw new Error(msg);
  }

  // אופציונלי: סגור טאבים שנשלחו בהצלחה
  if (closeAfterSend) {
    try {
      const ids = tabsRaw.map((t) => t.id).filter(Boolean);
      if (ids.length) await tabsRemove(ids);
    } catch (e) {
      console.warn("Failed closing tabs:", e);
    }
  }

  return { status: res.status, json, raw };
}

// ==== האזנה להודעות מה-popup ====
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "SAVE_SETTINGS") {
        const next = {
          apiUrl: (msg.apiUrl || "").trim(),
          apiKey: (msg.apiKey || "").trim(),
          closeAfterSend: !!msg.closeAfterSend,
        };
        await storageSet(next);
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === "SEND_TABS") {
        const scope = msg.scope === "current" ? "current" : "all";
        const result = await sendTabs(scope);
        sendResponse({ ok: true, result });
        return;
      }

      if (msg?.type === "TEST_GET") {
        const { apiUrl } = await storageGet(["apiUrl"]);
        const url = (apiUrl || DEFAULT_API_URL).trim();
        const res = await fetchWithTimeout(url, { method: "GET" }, 8000);
        const raw = await res.text();
        let json = {};
        try {
          json = raw ? JSON.parse(raw) : {};
        } catch {
          /* no-op */
        }
        sendResponse({ ok: res.ok, status: res.status, json, raw });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (err) {
      console.error("background error:", err);
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    }
  })();

  // משאיר את הערוץ פתוח עד שנסיים את העבודה הא-סינכרונית
  return true;
});
