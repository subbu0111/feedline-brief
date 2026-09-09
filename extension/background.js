function nextEightAmLocal() {
  const now = new Date();
  const next = new Date();
  next.setHours(8, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime();
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("feedline-morning", {
    when: nextEightAmLocal(),
    periodInMinutes: 24 * 60,
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "feedline-morning") return;
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Feedline · 8:00 briefing",
    message: "Open your LinkedIn feed, then click Feedline to capture the real posts.",
  });
});
