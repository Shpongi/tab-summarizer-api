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

function send(scope) {
  const apiBase = $("apiUrl").value.trim() || "http://localhost:3000";
  chrome.runtime.sendMessage({ type: "SEND_TABS", scope, apiBase }, (resp) => {
    if (chrome.runtime.lastError) { show("Background error: " + chrome.runtime.lastError.message); return; }
    if (!resp) { show("No response from background"); return; }
    if (resp.ok) show(`נשלחו ${resp.sent ?? 0} קישורים לטלגרם ✅`);
    else show(`נכשל (סטטוס ${resp.status ?? "?"}): ${resp.error || resp.raw || ""}`);
  });
}

$("sendCurrent").addEventListener("click", () => send("current"));
$("sendAll").addEventListener("click", () => send("all"));
