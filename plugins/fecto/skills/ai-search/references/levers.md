# What moves AI search visibility

Sources: docs/geo-guide.md in the Fecto repo.

| Lever | Evidence | In the repo? | Fecto prices it? |
|---|---|---|---|
| Search and user-fetch bots allowed in robots.txt and at the CDN | All or nothing: a blocked bot can't read the page | robots.txt yes; CDN is the owner's setting | Yes (ai_readable) |
| Indexed in Google and Bing; no noindex/nosnippet; in the sitemap | All or nothing | Yes | Yes (ai_readable) |
| Main text in the HTML without JavaScript | Most AI crawlers don't run JavaScript (Googlebot does) | Yes | Yes (ai_readable) |
| Pages that answer buyers' sub-questions, answer first, with real facts | Answers fan out into sub-queries; deep pages get cited (only 38% of AI Overview citations rank top 10) | Yes, with owner-confirmed facts | Yes (ai_answers), only for questions not yet answered |
| Mentions on other sites: lists, review platforms, YouTube, press | Strongest correlates (brand mentions 0.66, YouTube 0.74, backlinks 0.22); earned media is 69–92% of ChatGPT citations | No: the owner's work | Profiles and placements on pages Fecto can check, when available |
| Fresh, honest dates | Cited pages are fresher than average | Yes | Never on its own |
| llms.txt, FAQ schema, Markdown mirrors, chunking | No evidence; Google says not needed | Yes | Never |
| Rewriting pages "for AI" (quotes, statistics) | 3 of 54 cases significant on current models (C-SEO Bench) | Yes | Never |

AI answers are random: the same prompt returns the same brand list under 1% of the time. Track rates over many runs.
