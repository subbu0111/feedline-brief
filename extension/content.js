chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "FEEDLINE_CAPTURE") return;
  (async () => {
    try {
      const data = await window.FeedlineExtract.captureFeed();
      sendResponse({ ok: true, data });
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  })();
  return true;
});
