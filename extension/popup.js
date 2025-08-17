const $ = (id) => document.getElementById(id);
const show = (msg) => ($("status").textContent = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2));

function send(scope) {
  chrome.runtime.sendMessage({ type: "SEND_TABS", scope }, (resp) => {
    // אם ה־background לא ענה/נסגר – נקבל lastError במקום resp
    if (chrome.runtime.lastError) {
      show("Background error: " + chrome.runtime.lastError.message);
      return;
    }
    if (!resp) {
      show("No response from background");
      return;
    }
    if (resp.ok) show(resp.result);
    else show(`Request failed (status ${resp.status || "?"}): ${resp.error || JSON.stringify(resp.result)}`);
  });
}

$("sendCurrent").addEventListener("click", () => send("current"));
$("sendAll").addEventListener("click", () => send("all"));
