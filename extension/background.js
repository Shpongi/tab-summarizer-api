async function sendAllTabs() {
  const tabs = await chrome.tabs.query({});
  const data = tabs.map(t => ({ title: t.title, url: t.url }));

  const resp = await fetch('https://tab-summarizer-api.vercel.app/api/tabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: 'DEV_KEY',      // או למשוך מ-storage
      tabs: data
    })
  });
  const json = await resp.json();
  console.log('API response:', json);
}

// למשל בלחיצה על האייקון:
chrome.action.onClicked.addListener(sendAllTabs);
