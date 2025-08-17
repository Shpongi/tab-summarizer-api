const $ = (id) => document.getElementById(id);
const show = (msg) => ($("status").textContent = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2));

async function loadSettings() {
  const { apiUrl, apiKey } = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
  if (apiUrl) $("apiUrl").value = apiUrl;
  if (apiKey) $("apiKey").value = apiKey;
}

async function saveSettings() {
  await chrome.storage.sync.set({
    apiUrl: $("apiUrl").value.trim(),
    apiKey: $("apiKey").value.trim()
  });
  show("Saved ✅");
}

async function testGet() {
  const url = $("apiUrl").value.trim();
  if (!url) return show("Set API URL first");
  try {
    const res = await fetch(url, { method: "GET" });
    const json = await res.json();
    show(json);
  } catch (e) {
    show("GET failed: " + e);
  }
}

function send(scope) {
  chrome.runtime.sendMessage({ type: "SEND_TABS", scope }, (resp) => {
    if (!resp) return show("No response (check background errors)");
    if (resp.ok) show(resp.result);
    else show("Error: " + resp.error);
  });
}

$("save").addEventListener("click", saveSettings);
$("test").addEventListener("click", testGet);
$("sendCurrent").addEventListener("click", () => send("current"));
$("sendAll").addEventListener("click", () => send("all"));

loadSettings();
