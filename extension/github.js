(function (root) {
  function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function putFile({ token, owner, repo, path, content, message }) {
    if (!token) throw new Error("Add a GitHub token in Settings.");
    if (!owner || !repo) throw new Error("Set GitHub owner and repo in Settings.");
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
    const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    let sha;
    const existing = await fetch(api, { headers });
    if (existing.ok) {
      const json = await existing.json();
      sha = json.sha;
    }
    const res = await fetch(api, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message,
        content: toBase64(content),
        sha,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub write failed (${res.status}): ${body.slice(0, 240)}`);
    }
    return `https://${owner}.github.io/${repo}/`;
  }

  async function publishBriefing(settings, html, capture, brief) {
    const day = (brief.generatedAt || "").slice(0, 10);
    const pages = await putFile({
      ...settings,
      path: "docs/index.html",
      content: html,
      message: `briefing ${day}`,
    });
    await putFile({
      ...settings,
      path: `docs/archive/${day || "latest"}.html`,
      content: html,
      message: `archive ${day}`,
    });
    await putFile({
      ...settings,
      path: "data/latest-capture.json",
      content: JSON.stringify(capture, null, 2),
      message: `capture ${day}`,
    });
    await putFile({
      ...settings,
      path: "docs/briefing.json",
      content: JSON.stringify(brief, null, 2),
      message: `briefing json ${day}`,
    });
    return pages;
  }

  root.FeedlineGithub = { putFile, publishBriefing };
})(typeof window !== "undefined" ? window : self);
