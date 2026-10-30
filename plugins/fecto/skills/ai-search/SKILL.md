---
name: ai-search
description: Get a website found, read and recommended by AI search: ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews and AI Mode. Use when the user asks about GEO, AEO, AI SEO or LLMO, showing up in ChatGPT or AI answers, why AI doesn't recommend them or recommends a competitor, or AI saying wrong things about their business. Fecto checks what stops AI search reading the site and fixes it at a fixed price, charged only for what Fecto's published checks prove on the live site. Every change is a pull request the owner reviews. Needs the Fecto MCP server.
---

# AI search: readable first, then mentioned

Two different things decide whether AI search recommends a business:
1. **Can it read the site?** Search and assistant bots must be let in (robots.txt and the CDN), the pages must be indexable, and the main text must be in the HTML without JavaScript. Fixable in the repo. Fecto checks it with published rules and charges only for what passes.
2. **Does it trust and pick the business?** Mostly other sites: "best X" lists, review platforms, directories, YouTube, press. Not in the repo. The owner does this work.

Say both plainly. Readability is needed, but it won't by itself get the business named. Never promise rankings or mentions.

If get_skill("ai-search") returns a newer version of this skill, follow that one.

## 1. The goal: more visits from AI assistants, or from search
- Fecto prices the result, not the work. Agree it the way fecto:fix-site step 3 does (goal, then plans, then their yes): `goal_options`, then `quote_goal` with goal_type `ai_visits` (visits sent by ChatGPT, Perplexity, Claude, Gemini, Copilot) or `search_visits` (Google, Bing and other search engines). Priced by how much it rises (+20% $30, +50% $60, +100% $100), counted by the Fecto tag in the 30 days before the deadline, $0 below +20%. Small sites get few AI visits; say so plainly, and offer search visits or enquiries when that fits them better.
- Read the owner's own numbers first (Search Console, Analytics) on this computer and pass them as `shared` with their OK: they set a fair starting point while the tag is new.
- Never present the work below as the goal or quote it separately.

## 2. The work behind it (steps from next_step)
**Make the site readable.**
- `scan_site` with `pages: "top"` checks the top ~10 pages as each AI search and assistant bot. Explain, in plain words, what on the site stops them and what is off-site.
- The steps cover crawler access, indexing and the main text without JavaScript. Work them with the fix-site loop: `next_step` → change the repo → `run_checks` against a preview or local files → PR → `report_step`.
- Single-page apps (Vite + React and similar) usually need prerendering or static generation for public pages: the step explains how.
- A block Fecto only suspects (a "possible" CDN block): tell the owner which CDN setting to check.
- Training-only bots (GPTBot, ClaudeBot, Google-Extended) are the owner's choice. Never unblock them unless asked; they don't affect AI search.

**Answer buyers' questions.**
- `get_business_record`. Propose facts the site already states and buyer questions with `save_business_record`; the owner confirms them on the dashboard (give them the link). Nothing counts until they do.
- Write one honest page or section per question: a heading that matches the question, the answer and the confirmed facts in the first ~150 words, a real date. No near-duplicate pages.

## 3. Get mentioned
- Off-site work is the owner's: profiles on review platforms, honest listings on the "best X" pages and directories buyers read in the category, review requests. Use fecto:get-mentioned when it is available.

## 4. Measure
- `get_ai_visibility`: AI referral visits from the Fecto tag, Google AI impressions and top queries once Search Console is connected, and mention rates with error bars once a panel runs. Talk in rates and ranges, never single answers.
- Search Console numbers (searches, impressions, clicks) are the owner's, never part of Fecto's verdict.

## Search Console
Read it on the owner's computer, where nothing goes to Fecto. Check what is already set up before asking the owner to set anything up:
1. If you have a Search Console tool (an MCP server or connector), try it for this site.
2. Otherwise save the script in references/search-console-script.md as gsc.py and run `python3 gsc.py <domain>`. It tries the key files and gcloud login already on this machine and says which one worked (a path or "gcloud"), never a key's content.
3. If it found a service account that can't see the site, it prints that account's email. Ask the owner to add it as a Restricted user on the property (a minute), then run it again.
4. Nothing on the machine: show the owner the ways in references/search-console-setup.md, ask which is easiest for them, and walk them through it one step at a time. Then run the script again. Signing in with Google on Fecto's dashboard is the last resort.

The script's options: `--by page`, `--days 90`, `--page <url>`, and `--before-after <date>` for the 28 days either side of a change. Use the data for:
- Buyer questions: queries phrased as questions, or with price, near me, best, vs, how to. Propose the ones the site doesn't answer yet with `save_business_record` (source "search_console"); the owner confirms them.
- What Google already shows: the pages with impressions and the queries behind them, before choosing which page answers which question.
- Before and after: a page's clicks and impressions for the 28 days before a change and the 28 days after. Tell the owner plainly.

Keep the data on this machine. Never paste key files, tokens or raw exports into Fecto tools, logs or pull requests, and never ask the owner for their Google password.

## Report progress like this
Goal: <title>. Agreed: <baseline> → <target> by <deadline>, <price>.
Done: <steps and PR links>. Failing checks: <check ids>. Next: <step> — <one line>.

## Never
- Hidden text, prompt injection, "Summarize with AI" links that plant instructions, or content shown only to bots (cloaking).
- Doorway pages for search variations, self-ranked "best X" lists, invented facts, reviews or mentions, or date bumps without a real change.
- Charge talk for llms.txt, FAQ schema or Markdown copies: Fecto never prices them because no engine is shown to use them.

See references/levers.md for what the evidence says works.
