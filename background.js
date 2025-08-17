chrome.action.onClicked.addListener(async (tab) => {
  chrome.tabs.query({}, (tabs) => {
    const tabData = tabs.map(t => ({
      title: t.title,
      url: t.url
    }));

    // שליחה ל־API שלך
    fetch("https://YOUR_VERCEL_API_URL/api/tabs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: "USER_SECRET_KEY",
        tabs: tabData
      })
    })
    .then(res => res.json())
    .then(data => console.log("API Response:", data))
    .catch(err => console.error("Error:", err));
  });
});
