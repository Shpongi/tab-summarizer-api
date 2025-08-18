/* global chrome */
const $ = (id) => document.getElementById(id);

function setTextWithDirection(el, text) {
  const hebrew = /[\u0590-\u05FF]/;
  el.dir = hebrew.test(text) ? "rtl" : "ltr";
  el.textContent = text;
}

const show = (m) => {
  const el = $("status");
  const text = typeof m === "string" ? m : JSON.stringify(m, null, 2);
  setTextWithDirection(el, text);
};

// UI helpers
function setBusy(isBusy) {
  $("sendCurrent").disabled = isBusy;
  $("sendAll").disabled = isBusy;
  if (isBusy) show("שולח… רגע...");
}

// storage
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage?.sync?.get({ apiBase: "" }, (data) => resolve(data || {}));
  });
}
async function saveSettings(apiBase) {
  return new Promise((resolve) => {
    chrome.storage?.sync?.set({ apiBase }, () => resolve(true));
  });
}

// send with timeout wrapper
function sendWithTimeout(message, timeoutMs = 30000) { // 30s
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ ok: false, error: "Timeout: background did not respond in time" });
    }, timeoutMs);

    chrome.runtime.sendMessage(message, (resp) => {
      if (done) return;
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: "Background error: " + chrome.runtime.lastError.message });
      } else if (!resp) {
        resolve({ ok: false, error: "No response from background" });
      } else {
        resolve(resp);
      }
    });
  });
}

async function send(scope) {
  const inputVal = $("apiUrl").value.trim();
  const apiBase = inputVal || "https://tab-summarizer-api.vercel.app"; // ברירת מחדל לפרודקשן
  if (!/^https?:\/\//i.test(apiBase)) {
    show("API Base לא תקין (חייב להתחיל ב-http/https)");
    return;
  }

  // שמור את ה-API לשימוש הבא
  saveSettings(apiBase).catch(() => {});

  setBusy(true);
  try {
    const resp = await sendWithTimeout({ type: "SEND_TABS", scope, apiBase });
    if (resp.ok) {
      const cnt = Number(resp.sent ?? 0);
      show(`נשלחו ${cnt} קישורים לטלגרם ✅`);
    } else {
      const status = resp.status ?? "?";
      const err = resp.error || resp.raw || "שגיאה לא ידועה";
      show(`נכשל (סטטוס ${status}): ${err}`);
    }
  } catch (e) {
    show("שגיאה: " + (e?.message || String(e)));
  } finally {
    setBusy(false);
  }
}

// init
(async function init() {
  const { apiBase } = await loadSettings();
  if (apiBase) $("apiUrl").value = apiBase;
})();

$("sendCurrent").addEventListener("click", () => send("current"));
$("sendAll").addEventListener("click", () => send("all"));
