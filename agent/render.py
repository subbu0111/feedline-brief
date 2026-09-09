from __future__ import annotations

from datetime import datetime
from html import escape
from zoneinfo import ZoneInfo


def render_html(brief: dict) -> str:
    raw = brief.get("generatedAt") or ""
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(ZoneInfo("Asia/Kolkata"))
        pretty = dt.strftime("%A, %-d %b · %H:%M IST")
    except Exception:
        pretty = raw
    window = brief.get("windowDays", 2)
    model = escape(str(brief.get("model") or ""))
    notes = brief.get("notes") or ""
    cards = []
    for i, item in enumerate(brief.get("items") or []):
        comment = escape(item.get("comment") or "").replace("\n", "<br/>")
        cards.append(
            f"""<article class="card">
  <header>
    <div class="meta">
      <span class="num">{i + 1:02d}</span>
      <span>{escape(item.get("author") or "")}</span>
      <span class="dot">·</span>
      <span>{escape(item.get("relativeTime") or "")}</span>
    </div>
    <p class="summary">{escape(item.get("topicSummary") or "")}</p>
  </header>
  <blockquote>{comment}</blockquote>
  <footer>
    <button type="button" data-copy="{escape(item.get("comment") or "")}">Copy comment</button>
    <a href="{escape(item.get("postUrl") or "#")}" target="_blank" rel="noreferrer">Open post</a>
  </footer>
</article>"""
        )
    note_html = f'<p class="note">{escape(notes)}</p>' if notes else ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Feedline · {escape(pretty)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap" rel="stylesheet"/>
  <style>
    :root {{ --bg:#f3efe6; --ink:#14120f; --muted:#6b6459; --card:#fffcf7; --accent:#3d5a54; --line:rgba(20,18,15,.1); }}
    * {{ box-sizing: border-box; }}
    html, body {{ margin:0; background:var(--bg); color:var(--ink); font-family:Figtree,Segoe UI,sans-serif; line-height:1.5; }}
    body {{ padding:28px 18px 80px; }}
    main {{ max-width:42rem; margin:0 auto; }}
    .kicker {{ font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); }}
    h1 {{ font-family:Fraunces,Georgia,serif; font-weight:500; letter-spacing:-.03em; font-size:clamp(1.8rem,5vw,2.4rem); line-height:1.15; margin:8px 0 6px; }}
    .sub {{ color:var(--muted); margin:0 0 28px; }}
    .card {{ background:var(--card); border-radius:20px; padding:20px; box-shadow:0 0 0 1px var(--line),0 1px 2px rgba(20,18,15,.05); margin-bottom:14px; }}
    .meta {{ display:flex; flex-wrap:wrap; gap:6px; align-items:center; font-size:12px; color:var(--muted); }}
    .num {{ font-variant-numeric:tabular-nums; color:var(--accent); font-weight:600; }}
    .summary {{ font-family:Fraunces,Georgia,serif; font-size:1.05rem; margin:10px 0 14px; }}
    blockquote {{ margin:0; padding:12px 14px; background:#f3efe6; border-radius:12px; font-size:.95rem; }}
    footer {{ display:flex; gap:8px; margin-top:14px; }}
    button, a {{ min-height:44px; display:inline-flex; align-items:center; justify-content:center; padding:0 14px; border-radius:10px; text-decoration:none; font:inherit; font-weight:500; cursor:pointer; }}
    button {{ border:0; background:var(--accent); color:var(--bg); flex:1; }}
    a {{ background:#e7e0d2; color:var(--ink); }}
    .note {{ font-size:13px; color:var(--muted); margin-bottom:18px; }}
  </style>
</head>
<body>
<main>
  <div class="kicker">Feedline · real feed</div>
  <h1>Morning briefing</h1>
  <p class="sub">{escape(pretty)} · last {window} days · {model}</p>
  {note_html}
  {"".join(cards)}
</main>
<script>
  document.querySelectorAll("[data-copy]").forEach((btn) => {{
    btn.addEventListener("click", async () => {{
      const text = btn.getAttribute("data-copy") || "";
      try {{ await navigator.clipboard.writeText(text); btn.textContent = "Copied";
        setTimeout(() => {{ btn.textContent = "Copy comment"; }}, 1400); }} catch {{}}
    }});
  }});
</script>
</body>
</html>
"""
