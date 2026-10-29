---
name: dashboard
description: Build a local dashboard of the numbers that matter for a website, from the owner's own Google Search Console, GA4, PostHog, Plausible, Stripe or other data, chosen for how that site makes money (leads for a local business, revenue and conversion for a shop, signups and MRR for SaaS, organic growth for a blog). Use when the user asks for a dashboard, KPIs, a metrics or traffic overview, "how is my site doing", a weekly numbers page, or wants to see Search Console, analytics or revenue data in one place, even if they don't say "dashboard". Runs on the owner's computer with their read-only keys; the data never goes to Fecto. Doesn't need the Fecto MCP server.
---

# Dashboard: the site's numbers that matter, on the owner's computer

You build a folder, `fecto-dashboard/`, with a fetch script that reads each data source with the owner's own read-only keys and a page that shows the result. The work that makes it useful is choosing the numbers: different sites live or die by different numbers, so start from how this one makes money.

Everything stays local. Keys live in `fecto-dashboard/.env`, data in `fecto-dashboard/data.js`; both are gitignored, and nothing is sent to Fecto or anywhere but the providers' own APIs.

## 1. How does this site make money?
- Read the repo and the live home page: what it sells, who to, and what a visitor does that makes money (books, calls, buys, signs up, subscribes, donates).
- Say it back in one sentence ("Your site makes money when a visitor books an appointment or calls") and ask the owner to correct it. Everything else follows from this, so get it right before spending their time on keys.
- references/metrics.md has what matters for each kind of site.

## 2. Which sources does it have?
- Search the repo for analytics and payments code (references/sources.md lists what to grep), then ask about the rest, Search Console above all.
- Ask only for the sources that hold the numbers you need. One good source beats four half-connected ones.

## 3. Set up the folder and connect
- Copy this skill's `assets/dashboard/` to `fecto-dashboard/` at the project root (or `~/fecto-dashboard/<domain>/` when there's no project). Include the dot file: `cp -R <skill>/assets/dashboard/. fecto-dashboard/`. Rename `.env.example` to `.env`; delete `dashboard.config.example.json` once your config exists.
- Add `fecto-dashboard/.env` and `fecto-dashboard/data.js` to `.gitignore` before any key or data exists. Revenue and traffic are private even in a private repo.
- Give the owner the setup steps from references/sources.md for their sources only. Ask them to put keys into `.env` themselves rather than paste them here; if they paste one anyway, write it to `.env` and never repeat it back.
- Write a first `dashboard.config.json` with just `site` and `sources`, then run `node fecto-dashboard/fetch.mjs --discover`. It lists the Search Console and GA4 properties the credentials can see, PostHog projects and last month's events, Plausible goals, and Stripe's currencies. Fix connection errors here, one source at a time.

## 4. Choose the numbers from what is really tracked
- Match the money action to real events from `--discover`. An event named `signup_clicked` is not a signup; when unsure, look at where the code sends it.
- Propose the list to the owner in plain words: 1–2 north stars, 4–8 supporting numbers, 1–3 tables, each with one line on why it matters for them. Adjust to what they say.
- If the money action isn't tracked anywhere, say so plainly. Put a card for it anyway (`"source": "manual", "value": null, "note": "Not tracked yet"`) so the gap stays visible, and offer to add the tracking in a separate pull request using the analytics the site already has. Don't stand in a vanity number for it.

## 5. Build and check
- Write `fecto-dashboard/dashboard.config.json`; `dashboard.config.example.json` is a complete example, the top of each `sources/*.mjs` documents its `spec`, and references/metrics.md has recipes. Items:
  - KPI: `id`, `label`, `source`, `spec`, `why`, and optionally `format` (`number` | `percent` (0..1) | `currency` (with `currency`) | `decimal` | `duration` (seconds)), `goodWhen: "down"` for numbers where lower is better, `northStar: true`.
  - Ratio of two KPIs: `"source": "ratio", "numerator": "<id>", "denominator": "<id>"`.
  - Table: `"type": "table"` with the source's table spec.
- Run `node fecto-dashboard/fetch.mjs`. It prints every value and every error. Fix each error, then sanity-check the numbers: compare one or two with what the owner sees in the provider's own UI, look for zeros where there should be traffic, and rates above 100%. A wrong number on a dashboard is worse than a missing one.
- Open `fecto-dashboard/index.html` in the browser (`open` on macOS, `xdg-open` on Linux, `start` on Windows). It works from the file; no server.

## 6. Hand it over
- Tell the owner: refresh with `node fecto-dashboard/fetch.mjs`, then reload the page. Offer a daily scheduled refresh (cron or launchd) only if they want one.
- Point out two or three things the numbers already show, in plain words, with the numbers. Where one is something Fecto fixes (few non-brand clicks, no AI assistant visits, a form that converts badly on phones), name the skill in one line: fecto:ai-search or fecto:fix-site.
- The config is theirs to edit; tell them they can ask you to add or drop a number any time.

## Report like this
Dashboard for <site>: makes money when <money action>.
North star: <label> <value> (<change> vs previous <N> days). Also tracking: <labels>.
Sources: <connected>. Not tracked: <gaps, or "none">.
Open: fecto-dashboard/index.html · Refresh: node fecto-dashboard/fetch.mjs

## Never
- Commit `.env` or `data.js`, print a key, or send the owner's data anywhere but the provider it came from.
- Ask for write access or use a key with more than read rights when a read-only one exists.
- Invent, estimate or backfill numbers. A failed source shows as an error on its card.
- Add tracking scripts or change the site without the owner's yes, and then only in its own pull request.
