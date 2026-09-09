from __future__ import annotations

import argparse
import json
from pathlib import Path

from .pipeline import draft
from .render import render_html


def main() -> None:
    parser = argparse.ArgumentParser(description="Draft a Feedline briefing from a LinkedIn capture JSON")
    parser.add_argument("--input", required=True, help="Path to capture.json from the Chrome extension")
    parser.add_argument("--out", default="docs/index.html")
    parser.add_argument("--json-out", default="docs/briefing.json")
    parser.add_argument("--archive-dir", default="docs/archive")
    parser.add_argument("--model", default=None)
    args = parser.parse_args()

    raw = json.loads(Path(args.input).read_text(encoding="utf-8"))
    posts = raw["posts"] if isinstance(raw, dict) and "posts" in raw else raw
    brief = draft(posts, model=args.model)
    html = render_html(brief)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")

    json_out = Path(args.json_out)
    json_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(brief, indent=2), encoding="utf-8")

    day = (brief.get("generatedAt") or "")[:10]
    if day:
        archive = Path(args.archive_dir) / f"{day}.html"
        archive.parent.mkdir(parents=True, exist_ok=True)
        archive.write_text(html, encoding="utf-8")

    print(f"Wrote {out} ({len(brief['items'])} posts, {brief['windowDays']}-day window)")


if __name__ == "__main__":
    main()
