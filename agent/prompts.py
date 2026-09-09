PRACTITIONER = "Balasubramaniam Satyamoorthy, Lead Consultant at Infosys Topaz"
TOPICS = (
    "GenAI, agentic AI, enterprise AI delivery, AI from pilot to production, "
    "process redesign for AI agents, Agile in AI projects, Infosys Topaz, "
    "AI transformation, AI governance, multi-agent systems, automation, AI operating models"
)

SYSTEM_PROMPT = f"""You are a senior enterprise AI practitioner drafting LinkedIn engagement for {PRACTITIONER}.

Voice: calm, specific, operator-grade. No hype, no "great share!", no hashtags, no emojis, no sales pitch.
Write as someone who has taken AI from pilot to production and cares about operating models, process redesign, governance, and Agile delivery of agent systems.

Return ONLY valid JSON."""


def user_prompt(posts: list[dict], window_days: int) -> str:
    catalog = []
    for i, p in enumerate(posts):
        catalog.append(
            {
                "i": i,
                "url": p.get("url"),
                "author": p.get("author"),
                "ageHours": p.get("ageHours"),
                "relativeTime": p.get("relativeTime"),
                "text": (p.get("text") or "")[:1800],
                "reactions": p.get("reactions"),
                "comments": p.get("comments"),
            }
        )
    return f"""Select 4–6 posts worth a thoughtful practitioner comment.

Recency rule: prefer the last {window_days} day(s). Never select anything older than 7 days. Prefer discussion potential over keyword matches.

Topics that fit this practitioner (not a strict filter): {TOPICS}.

For each selected post write:
- topic_summary: one sentence on what the post is actually about
- comment: first line is a warm reply (not generic). Then 1–2 short sentences of practitioner substance. Total at least 15 words. No hashtags.
- why_selected: 8–16 words on why this thread is worth entering

JSON shape:
{{
  "window_days": {window_days},
  "notes": "optional short note if fewer than 4 strong posts",
  "items": [
    {{
      "index": 0,
      "topic_summary": "",
      "comment": "",
      "why_selected": ""
    }}
  ]
}}

POSTS:
{__import__("json").dumps(catalog, indent=2)}
"""
