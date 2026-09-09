(function (root) {
  const SYSTEM = `You are a senior enterprise AI practitioner drafting LinkedIn engagement for Balasubramaniam Satyamoorthy, Lead Consultant, Infosys Topaz.

Voice: calm, specific, operator-grade. No hype, no "great share!", no hashtags, no emojis, no sales pitch. Write as someone who has taken AI from pilot to production and cares about operating models, process redesign, governance, and Agile delivery of agent systems.

Return ONLY valid JSON.`;

  const TOPICS =
    "GenAI, agentic AI, enterprise AI delivery, AI from pilot to production, process redesign for AI agents, Agile in AI projects, Infosys Topaz, AI transformation, AI governance, multi-agent systems, automation, AI operating models";

  const MODELS = ["nvidia/nemotron-3.5-lightning:free", "google/gemini-2.5-flash-lite"];

  function withinWindow(ageHours, days) {
    if (ageHours == null) return days >= 7;
    return ageHours <= days * 24 + 0.5;
  }

  function selectPool(posts) {
    const recent = posts.filter((p) => withinWindow(p.ageHours, 2));
    if (recent.length >= 4) return { windowDays: 2, pool: recent };
    const week = posts.filter((p) => withinWindow(p.ageHours, 7));
    return { windowDays: 7, pool: week.length ? week : posts };
  }

  function userPrompt(posts, windowDays) {
    const catalog = posts.map((p, i) => ({
      i,
      url: p.url,
      author: p.author,
      ageHours: p.ageHours,
      relativeTime: p.relativeTime,
      text: String(p.text || "").slice(0, 1800),
      reactions: p.reactions ?? null,
      comments: p.comments ?? null,
    }));
    return `Select 4–6 posts worth a thoughtful practitioner comment.

Recency rule: prefer the last ${windowDays} day(s). Never select anything older than 7 days. Prefer discussion potential over keyword matches.

Topics that fit this practitioner (not a strict filter): ${TOPICS}.

For each selected post write:
- topic_summary: one sentence on what the post is actually about
- comment: first line is a warm reply (not generic). Then 1–2 short sentences of practitioner substance. Total at least 15 words. No hashtags. No "congrats on the insights".
- why_selected: 8–16 words on why this thread is worth entering

JSON shape:
{
  "window_days": ${windowDays},
  "notes": "optional short note if fewer than 4 strong posts",
  "items": [
    { "index": 0, "topic_summary": "", "comment": "", "why_selected": "" }
  ]
}

POSTS:
${JSON.stringify(catalog, null, 2)}`;
  }

  async function chat(apiKey, model, user) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://feedline.app",
        "X-Title": "Feedline",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${model} failed (${res.status}): ${body.slice(0, 240)}`);
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty model response");
    return content;
  }

  function parseJson(raw) {
    const fenced = String(raw).match(/\{[\s\S]*\}/);
    if (!fenced) throw new Error("Model did not return JSON");
    return JSON.parse(fenced[0]);
  }

  async function draftBriefing(posts, apiKey, preferred) {
    if (!apiKey) throw new Error("Add your OpenRouter key in Settings.");
    if (!posts?.length) throw new Error("No posts captured.");
    const { windowDays, pool } = selectPool(posts);
    const order = [preferred, ...MODELS].filter(Boolean);
    const unique = [...new Set(order)];
    let parsed = null;
    let used = unique[0];
    let lastError = "Unknown error";
    for (const model of unique) {
      try {
        const raw = await chat(apiKey, model, userPrompt(pool, windowDays));
        parsed = parseJson(raw);
        used = model;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    if (!parsed) throw new Error(lastError);
    const items = [];
    for (const row of parsed.items || []) {
      const post = pool[row.index];
      if (!post) continue;
      const comment = String(row.comment || "").trim();
      const summary = String(row.topic_summary || "").trim();
      if (!comment || !summary) continue;
      items.push({
        postUrl: post.url,
        author: post.author,
        relativeTime: post.relativeTime,
        ageHours: post.ageHours,
        topicSummary: summary,
        comment,
        whySelected: String(row.why_selected || "").trim(),
      });
      if (items.length >= 6) break;
    }
    if (!items.length) throw new Error("Model returned no usable comments");
    return {
      generatedAt: new Date().toISOString(),
      windowDays,
      source: "linkedin-feed",
      model: used,
      items,
      notes:
        parsed.notes ||
        (items.length < 4
          ? "Fewer than 4 strong posts in this capture. Scroll the feed further and capture again."
          : undefined),
    };
  }

  function esc(s) {
    return String(s)
      .replaceAll("&", "&")
      .replaceAll("<", "<")
      .replaceAll(">", ">")
      .replaceAll('"', """);
  }

  function renderHtml(brief) {
    const date = new Date(brief.generatedAt);
    const pretty = Number.isNaN(date.getTime())
      ? brief.generatedAt
      : date.toLocaleString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
        });
    const cards = (brief.items || [])
      .map((item, i) => {
        const commentHtml = esc(item.comment).replaceAll("\n", "<br/>");
        return `<article class="card">
  <header>
    <div class="meta">
      <span class="num">${String(i + 1).padStart(2, "0")}</span>
      <span>${esc(item.author)}</span>
      <span class="dot">·</span>
      <span>${esc(item.relativeTime || "")}</span>
    </div>
    <p class="summary">${esc(item.topicSummary)}</p>
  </header>
  <blockquote>${commentHtml}</blockquote>
  <footer>
    <button type="button" data-copy="${esc(item.comment)}">Copy comment</button>
    <a href="${esc(item.postUrl)}" target="_blank" rel="noreferrer">Open post</a>
  </footer>
</article>`;
      })
      .join("\n");
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Feedline · ${esc(pretty)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap" rel="stylesheet"/>
  <style>
    :root { --bg:#f3efe6; --ink:#14120f; --muted:#6b6459; --card:#fffcf7; --accent:#3d5a54; --line:rgba(20,18,15,.1); }
    * { box-sizing: border-box; }
    html, body { margin:0; background:var(--bg); color:var(--ink); font-family:Figtree,Segoe UI,sans-serif; line-height:1.5; }
    body { padding:28px 18px 80px; }
    main { max-width:42rem; margin:0 auto; }
    .kicker { font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); }
    h1 { font-family:Fraunces,Georgia,serif; font-weight:500; letter-spacing:-.03em; font-size:clamp(1.8rem,5vw,2.4rem); line-height:1.15; margin:8px 0 6px; }
    .sub { color:var(--muted); margin:0 0 28px; }
    .card { background:var(--card); border-radius:20px; padding:20px; box-shadow:0 0 0 1px var(--line),0 1px 2px rgba(20,18,15,.05); margin-bottom:14px; }
    .meta { display:flex; flex-wrap:wrap; gap:6px; align-items:center; font-size:12px; color:var(--muted); }
    .num { font-variant-numeric:tabular-nums; color:var(--accent); font-weight:600; }
    .summary { font-family:Fraunces,Georgia,serif; font-size:1.05rem; margin:10px 0 14px; }
    blockquote { margin:0; padding:12px 14px; background:#f3efe6; border-radius:12px; white-space:pre-wrap; font-size:.95rem; }
    footer { display:flex; gap:8px; margin-top:14px; }
    button, a { min-height:44px; display:inline-flex; align-items:center; justify-content:center; padding:0 14px; border-radius:10px; text-decoration:none; font:inherit; font-weight:500; cursor:pointer; }
    button { border:0; background:var(--accent); color:var(--bg); flex:1; }
    a { background:#e7e0d2; color:var(--ink); }
    .note { font-size:13px; color:var(--muted); margin-bottom:18px; }
  </style>
</head>
<body>
<main>
  <div class="kicker">Feedline · real feed</div>
  <h1>Morning briefing</h1>
  <p class="sub">${esc(pretty)} · last ${brief.windowDays} days · ${esc(brief.model || "")}</p>
  ${brief.notes ? `<p class="note">${esc(brief.notes)}</p>` : ""}
  ${cards}
</main>
<script>
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-copy") || "";
      try { await navigator.clipboard.writeText(text); btn.textContent = "Copied";
        setTimeout(() => { btn.textContent = "Copy comment"; }, 1400); } catch {}
    });
  });
</script>
</body>
</html>`;
  }

  root.FeedlineDraft = { draftBriefing, renderHtml, MODELS };
})(typeof window !== "undefined" ? window : self);
