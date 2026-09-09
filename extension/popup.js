const logEl = document.getElementById("log");
const hintEl = document.getElementById("hint");
const captureBtn = document.getElementById("capture");
const publishBtn = document.getElementById("publish");
const downloadBtn = document.getElementById("download");
let lastCapture = null;

function log(msg) {
  logEl.textContent = msg;
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadSettings() {
  const stored = await chrome.storage.local.get([
    "openrouterKey",
    "githubToken",
    "githubOwner",
    "githubRepo",
    "model",
  ]);
  return {
    apiKey: stored.openrouterKey || "",
    token: stored.githubToken || "",
    owner: stored.githubOwner || "subbu0111",
    repo: stored.githubRepo || "feedline-brief",
    model: stored.model || "nvidia/nemotron-3.5-lightning:free",
  };
}

captureBtn.addEventListener("click", async () => {
  const tab = await currentTab();
  if (!tab?.id || !/linkedin\.com/i.test(tab.url || "")) {
    log("Open linkedin.com/feed in this tab first. Stay logged in as yourself.");
    return;
  }
  captureBtn.disabled = true;
  publishBtn.disabled = true;
  downloadBtn.disabled = true;
  log("Scrolling your Home feed and reading the posts on the page…");
  try {
    let res;
    try {
      res = await chrome.tabs.sendMessage(tab.id, { type: "FEEDLINE_CAPTURE" });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["extract.js", "content.js"],
      });
      res = await chrome.tabs.sendMessage(tab.id, { type: "FEEDLINE_CAPTURE" });
    }
    if (!res?.ok) throw new Error(res?.error || "Capture failed");
    lastCapture = res.data;
    const n = lastCapture.posts?.length || 0;
    log(
      n
        ? `${n} posts from YOUR LinkedIn session.\nNot indexed search. Draft and publish so the phone page updates.`
        : "No posts found. Open Home / Feed, scroll once, capture again.",
    );
    downloadBtn.disabled = n === 0;
    publishBtn.disabled = n === 0;
    hintEl.textContent = n ? "Real feed. Your session." : "Open linkedin.com/feed and try again.";
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
  } finally {
    captureBtn.disabled = false;
  }
});

publishBtn.addEventListener("click", async () => {
  if (!lastCapture?.posts?.length) {
    log("Capture the feed first.");
    return;
  }
  const settings = await loadSettings();
  publishBtn.disabled = true;
  captureBtn.disabled = true;
  try {
    log("Drafting practitioner comments…");
    const brief = await FeedlineDraft.draftBriefing(
      lastCapture.posts,
      settings.apiKey,
      settings.model,
    );
    log(`Drafted ${brief.items.length} comments. Publishing HTML to GitHub…`);
    const html = FeedlineDraft.renderHtml(brief);
    const url = await FeedlineGithub.publishBriefing(
      {
        token: settings.token,
        owner: settings.owner,
        repo: settings.repo,
      },
      html,
      lastCapture,
      brief,
    );
    log(`Published ${brief.items.length} posts.\nPhone: ${url}\nEnable GitHub Pages on /docs if this is the first run.`);
    hintEl.textContent = "Open the phone page, copy a comment, paste on LinkedIn.";
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
  } finally {
    publishBtn.disabled = false;
    captureBtn.disabled = false;
  }
});

downloadBtn.addEventListener("click", () => {
  if (!lastCapture) return;
  const blob = new Blob([JSON.stringify(lastCapture, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url,
    filename: "feedline-capture.json",
    saveAs: true,
  });
});
