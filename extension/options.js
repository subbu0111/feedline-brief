const fields = {
  openrouterKey: document.getElementById("or"),
  model: document.getElementById("model"),
  githubOwner: document.getElementById("owner"),
  githubRepo: document.getElementById("repo"),
  githubToken: document.getElementById("gh"),
};
const status = document.getElementById("status");

chrome.storage.local.get(Object.keys(fields)).then((stored) => {
  for (const [key, el] of Object.entries(fields)) {
    if (stored[key]) el.value = stored[key];
  }
});

document.getElementById("save").addEventListener("click", async () => {
  const payload = {};
  for (const [key, el] of Object.entries(fields)) payload[key] = el.value.trim();
  await chrome.storage.local.set(payload);
  status.textContent = "Saved on this computer.";
});
