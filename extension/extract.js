(function (root) {
  function clean(s) {
    return String(s || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function parseRelativeHours(raw) {
    const t = clean(raw)
      .toLowerCase()
      .replace(/posted\s+/g, "")
      .split(/[•·|]/)[0]
      .trim();
    if (!t) return null;
    if (/just now|^now$|few seconds|a moment/.test(t)) return 0;
    const m = t.match(/(\d+)\s*(minute|min|m|hour|hr|h|day|d|week|wk|w|month|mo)s?\b/i);
    if (!m) return null;
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (["m", "min", "minute"].includes(unit)) return n / 60;
    if (["h", "hr", "hour"].includes(unit)) return n;
    if (["d", "day"].includes(unit)) return n * 24;
    if (["w", "wk", "week"].includes(unit)) return n * 24 * 7;
    if (["mo", "month"].includes(unit)) return n * 24 * 30;
    return null;
  }

  function cardNodes() {
    const seen = new Set();
    const out = [];
    const nodes = document.querySelectorAll(
      [
        'div[data-urn^="urn:li:activity:"]',
        'div[data-urn^="urn:li:ugcPost:"]',
        'div[data-urn^="urn:li:share:"]',
        "article[data-urn]",
        ".feed-shared-update-v2",
        'div[data-view-name="feed-full-update"]',
        'div[data-view-name="feed-update"]',
      ].join(","),
    );
    nodes.forEach((el) => {
      const urn =
        el.getAttribute("data-urn") || el.querySelector("[data-urn]")?.getAttribute("data-urn") || "";
      const key = urn || el;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(el);
    });
    return out;
  }

  function isJunk(card) {
    const urn = card.getAttribute("data-urn") || "";
    if (/lynda|ts_promo|sponsored|jobPosting/i.test(urn)) return true;
    if (card.querySelector(".discover-entity-type-card, .pymk-box, [data-view-name='feed-pymk']")) {
      return true;
    }
    const promo = clean(
      card.querySelector(
        ".update-components-actor__description, .feed-shared-actor__description, .update-components-actor__supplementary-actor-info",
      )?.innerText,
    ).toLowerCase();
    if (promo === "promoted" || promo === "sponsored") return true;
    const aria = (card.getAttribute("aria-label") || "").toLowerCase();
    if (aria.includes("promoted") || aria.includes("sponsored")) return true;
    return false;
  }

  function pickUrl(card, urn) {
    const a = card.querySelector(
      'a[href*="/feed/update/"], a[href*="/posts/"], a[href*="activity:"], a.update-components-actor__sub-description-link',
    );
    let href = a?.getAttribute("href") || "";
    if (href.startsWith("/")) href = "https://www.linkedin.com" + href;
    if (href) {
      try {
        const u = new URL(href, "https://www.linkedin.com");
        return u.origin + u.pathname;
      } catch {
        return href.split("?")[0];
      }
    }
    if (urn) return "https://www.linkedin.com/feed/update/" + urn;
    return "";
  }

  function pickAuthor(card) {
    const sels = [
      '.update-components-actor__title span[aria-hidden="true"]',
      ".update-components-actor__title",
      ".update-components-actor__name",
      ".feed-shared-actor__name",
      ".hoverable-link-text",
    ];
    for (const sel of sels) {
      const t = clean(card.querySelector(sel)?.innerText)
        .split("\n")[0]
        .replace(/\s*[•·].*$/, "")
        .replace(/\s+\d+(st|nd|rd|th)$/i, "");
      if (t && t.length > 1 && t.length < 90 && !/^follow$/i.test(t) && !/^view$/i.test(t)) {
        return t;
      }
    }
    return "Unknown";
  }

  function pickTime(card) {
    const t = card.querySelector("time");
    if (t) return clean(t.getAttribute("datetime") || t.innerText);
    const sub = card.querySelector(
      ".update-components-actor__sub-description, .feed-shared-actor__sub-description, a.update-components-actor__sub-description-link",
    );
    return clean(sub?.innerText).split(/[•·]/)[0];
  }

  function pickText(card) {
    const sels = [
      ".update-components-text",
      ".feed-shared-update-v2__description",
      ".feed-shared-text",
      ".update-components-update-v2__commentary",
      ".feed-shared-inline-show-more-text",
      '[data-test-id="main-feed-activity-card__commentary"]',
    ];
    for (const sel of sels) {
      const t = clean(card.querySelector(sel)?.innerText);
      if (t && t.length > 40) return t.replace(/\s*see more$/i, "");
    }
    const blocks = [...card.querySelectorAll("span[dir='ltr'], p")].map((n) => clean(n.innerText));
    const longest = blocks.sort((a, b) => b.length - a.length)[0] || "";
    return longest.replace(/\s*see more$/i, "");
  }

  function pickCount(card, re) {
    const t = clean(card.innerText);
    const m = t.match(re);
    if (!m) return null;
    const raw = m[1].replace(/,/g, "");
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function expandSeeMore(root) {
    const buttons = root.querySelectorAll("button, span[role='button']");
    let n = 0;
    buttons.forEach((btn) => {
      const label = clean(btn.innerText || btn.getAttribute("aria-label"));
      if (/^see more$/i.test(label) || /see more/i.test(label)) {
        try {
          btn.click();
          n += 1;
        } catch {
          /* ignore */
        }
      }
    });
    return n;
  }

  function scrollerEl() {
    return (
      document.querySelector(".scaffold-finite-scroll") ||
      document.querySelector("main") ||
      document.scrollingElement
    );
  }

  async function boundedScroll(target) {
    const scroller = scrollerEl();
    for (let i = 0; i < 12; i += 1) {
      expandSeeMore(document);
      const usable = cardNodes().filter((c) => !isJunk(c)).length;
      if (usable >= target) break;
      const before = scroller.scrollTop || window.scrollY;
      const delta = Math.round((scroller.clientHeight || window.innerHeight) * 0.85);
      if (scroller === document.scrollingElement || scroller === document.documentElement) {
        window.scrollBy(0, delta);
      } else {
        scroller.scrollBy(0, delta);
      }
      await sleep(700);
      const after = scroller.scrollTop || window.scrollY;
      if (Math.abs(after - before) < 24) break;
    }
  }

  function harvest() {
    const posts = [];
    const seen = new Set();
    for (const card of cardNodes()) {
      if (isJunk(card)) continue;
      const urn =
        card.getAttribute("data-urn") || card.querySelector("[data-urn]")?.getAttribute("data-urn") || "";
      const text = pickText(card);
      if (!text || text.length < 50) continue;
      const url = pickUrl(card, urn);
      if (!url) continue;
      const id = urn || url;
      if (seen.has(id)) continue;
      seen.add(id);
      const relativeTime = pickTime(card);
      posts.push({
        id,
        url,
        author: pickAuthor(card),
        text,
        relativeTime,
        ageHours: parseRelativeHours(relativeTime),
        reactions: pickCount(card, /([\d,.]+)\s*(reactions?|likes?)/i),
        comments: pickCount(card, /([\d,.]+)\s*comments?/i),
      });
    }
    return posts;
  }

  async function captureFeed() {
    const onLinkedIn = /linkedin\.com/i.test(location.hostname);
    if (!onLinkedIn) throw new Error("Open LinkedIn in this tab first.");
    await boundedScroll(22);
    expandSeeMore(document);
    await sleep(450);
    const posts = harvest();
    return {
      capturedAt: new Date().toISOString(),
      source: "linkedin-feed",
      page: location.href,
      posts,
    };
  }

  root.FeedlineExtract = { captureFeed, parseRelativeHours };
})(typeof window !== "undefined" ? window : self);
