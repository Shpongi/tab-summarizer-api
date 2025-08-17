const $ = (id) => document.getElementById(id);
const show = (m) => ($("status").textContent = typeof m === "string" ? m : JSON.stringify(m, null, 2));

function send(scope) {
  chrome.runtime.sendMessage({ type: "SEND_TABS", scope }, (resp) => {
    if (chrome.runtime.lastError) {
      show("Background error: " + chrome.runtime.lastError.message);
      return;
    }
    if (!resp) { show("No response from background"); return; }
    if (resp.ok) show(resp.result);
    else show(`Request failed (status ${resp.status || "?"}): ${resp.error || JSON.stringify(resp.result)}`);
  });
}

$("sendCurrent").addEventListener("click", () => send("current"));
$("sendAll").addEventListener("click", () => send("all"));
