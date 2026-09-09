# Feedline

Capture the LinkedIn Home feed you can already see (your Chrome session), draft practitioner comments, publish an HTML briefing you open on your phone.

This does **not** log into LinkedIn. It does **not** use Google’s index of LinkedIn posts. You stay logged in as yourself. You still paste the comment.

## Morning loop

1. Laptop Chrome is logged into LinkedIn.
2. Open `linkedin.com/feed`.
3. Click **Feedline → Capture real feed**.
4. Click **Draft comments and publish**.
5. On your phone, open the GitHub Pages URL, copy a comment, open the post, paste.

An 8:00 reminder fires on the computer where the extension is installed.

## Chrome extension

Unzip `extension/` (or the zip from the Feedline desk). Chrome → Extensions → Developer mode → Load unpacked.

In the extension Settings page add:

- OpenRouter key (`nvidia/nemotron-3.5-lightning:free`, fallback `google/gemini-2.5-flash-lite`)
- GitHub token with `contents: write` on this repo
- Owner `subbu0111`, repo `feedline-brief`

## Python agent

Same ranking + HTML writer, for GitHub Actions or a local run:

```
python -m agent --input data/latest-capture.json --out docs/index.html
```

Set `OPENROUTER_API_KEY` as a GitHub Actions secret if you want the workflow path.

## GitHub Pages

Repo Settings → Pages → Deploy from branch `main` → folder `/docs`.
Phone URL: https://subbu0111.github.io/feedline-brief/
