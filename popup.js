document.getElementById("sendAll").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "send_all" });
});

document.getElementById("sendOne").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "send_one" });
});
