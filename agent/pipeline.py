from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

from .prompts import SYSTEM_PROMPT, user_prompt

MODELS = [
    "nvidia/nemotron-3.5-lightning:free",
    "google/gemini-2.5-flash-lite",
]


def within_window(age_hours: float | None, days: int) -> bool:
    if age_hours is None:
        return days >= 7
    return age_hours <= days * 24 + 0.5


def select_pool(posts: list[dict]) -> tuple[int, list[dict]]:
    recent = [p for p in posts if within_window(p.get("ageHours"), 2)]
    if len(recent) >= 4:
        return 2, recent
    week = [p for p in posts if within_window(p.get("ageHours"), 7)]
    return 7, week or posts


def _chat(api_key: str, model: str, user: str) -> str:
    payload = {
        "model": model,
        "temperature": 0.4,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
    }
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://feedline.app",
            "X-Title": "Feedline",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            body = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")[:280]
        raise RuntimeError(f"{model} failed ({err.code}): {detail}") from err
    content = body.get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        raise RuntimeError("Empty model response")
    return content


def _parse(raw: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise RuntimeError("Model did not return JSON")
    return json.loads(match.group(0))


def draft(posts: list[dict], api_key: str | None = None, model: str | None = None) -> dict:
    api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is missing")
    if not posts:
        raise RuntimeError("No posts in capture")

    window_days, pool = select_pool(posts)
    preferred = [model] if model else []
    last_error = "Unknown error"
    parsed = None
    used = model or MODELS[0]
    for candidate in list(dict.fromkeys(preferred + MODELS)):
        try:
            raw = _chat(api_key, candidate, user_prompt(pool, window_days))
            parsed = _parse(raw)
            used = candidate
            break
        except Exception as err:  # noqa: BLE001 — try next model
            last_error = str(err)
    if parsed is None:
        raise RuntimeError(last_error)

    items = []
    for row in parsed.get("items") or []:
        try:
            post = pool[int(row.get("index"))]
        except Exception:
            continue
        comment = (row.get("comment") or "").strip()
        summary = (row.get("topic_summary") or "").strip()
        if not comment or not summary:
            continue
        items.append(
            {
                "postUrl": post.get("url"),
                "author": post.get("author"),
                "relativeTime": post.get("relativeTime"),
                "ageHours": post.get("ageHours"),
                "topicSummary": summary,
                "comment": comment,
                "whySelected": (row.get("why_selected") or "").strip(),
            }
        )
        if len(items) >= 6:
            break
    if not items:
        raise RuntimeError("Model returned no usable comments")

    notes = parsed.get("notes")
    if not notes and len(items) < 4:
        notes = "Fewer than 4 strong posts in this capture. Scroll the feed further and capture again."

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "windowDays": window_days,
        "source": "linkedin-feed",
        "model": used,
        "items": items,
        "notes": notes,
    }
