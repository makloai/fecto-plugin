# Choosing the metrics

A dashboard is worth opening only if each number on it could change what the owner does next week. Start from how the site makes money, not from what the APIs offer.

## Contents
- How to choose
- By kind of site: local service, e-commerce, SaaS, content, marketplace, nonprofit / brochure
- Metrics every site gets
- Recipes per source (event names, filters, queries)

## How to choose

1. **Name the money action** in one sentence: "the site makes money when a visitor ___". Book, call, buy, sign up and later pay, subscribe, donate, apply. That action is the north star. A site can have two (a SaaS with self-serve signups and "talk to sales"); rarely more.
2. **Work backwards** from it: how many people arrive (and from where), what share of them take the action, and what the action is worth. Count + rate + value, in that order.
3. **Keep it short**: 1–2 north stars, 4–8 other numbers, 1–3 tables. Anything else goes in the product's own analytics.
4. **Pair every rate with its count.** A conversion rate going up while conversions go down is bad news; showing one without the other hides it.
5. **Split brand from non-brand search.** Clicks from people who typed the business name measure reputation; non-brand clicks measure being found by new people. Exclude the brand with a regex on the query, covering misspellings and the domain.
6. **Use only what is really tracked.** Confirm every event name with `--discover` before using it. If the money action isn't tracked at all, say so and show it as a missing card (see SKILL.md), don't substitute a vanity number.
7. **Leave out** numbers that don't lead to a decision: total pageviews, average time on site, bounce rate on its own, follower counts, "hits".

Write the `why` for each item in the owner's language, one sentence: what it tells them, or what to do when it moves.

## By kind of site

Sites mix these; pick from more than one list when they do.

### Local service / lead generation (dentist, plumber, law firm, agency)
Money action: a request, booking or call.
- **North star**: leads = form submissions + booking completions + phone/WhatsApp taps (`tel:`/`wa.me` link clicks). Show them separately if the owner treats them differently.
- Visitor → lead rate.
- Non-brand Google clicks, and impressions for "near me"/city queries.
- Visits from AI assistants.
- Share of visits on mobile, and mobile lead rate vs desktop (local traffic is mostly phones; a gap means the mobile form is the problem).
- Tables: top landing pages by leads, searches almost on page one (positions 4–15).

### E-commerce
Money action: a purchase.
- **North star**: revenue (Stripe, or the purchase event's value in GA4/PostHog).
- Orders, conversion rate (orders ÷ sessions), average order value (revenue ÷ orders).
- Funnel steps as rates: product view → add to cart → checkout started → purchase. A drop at one step points at that page.
- Returning-customer share of orders if the data allows it.
- Non-brand organic clicks to product and category pages.
- Tables: top products or landing pages by revenue, sources by revenue (not by sessions).

### SaaS / app
Money actions: signup, then activation, then paid.
- **North star**: new paying customers or new MRR (Stripe); before there is revenue, signups that reach activation.
- Signups and visitor → signup rate.
- Activation: share of new signups who do the key action within 7 days. Find the key action in the event list (created a project, invited a teammate, connected data); ask the owner if unclear.
- MRR and active subscriptions (Stripe snapshots).
- Pricing page visitors, demo/contact requests.
- Docs and blog traffic as a separate number only if they drive signups.
- Tables: signup sources, top pages before signup.

### Content / publisher / blog / newsletter
Money action: a subscription, an ad impression, an affiliate click.
- **North star**: newsletter or paid signups, or affiliate clicks; for ad-funded sites, engaged visitors.
- Non-brand organic clicks and impressions (the growth engine).
- Returning visitors share.
- Visits from AI assistants (AI answers increasingly replace the click; watch it).
- Tables: top articles by clicks, queries almost on page one sorted by impressions, articles losing clicks vs the previous period (two GSC tables or a PostHog query).

### Marketplace / directory / community
Two sides; each needs its own action.
- **North stars**: supply side (listings created, providers signed up) and demand side (searches with a result, contacts, transactions).
- Match rate: searches or visits that end in a contact/transaction.
- Non-brand organic clicks to listing pages.
- Tables: top categories or locations by demand.

### Nonprofit / brochure / portfolio
Money action: a donation, an enquiry, an application.
- **North star**: that action (Stripe donations, form submissions).
- Visitors and visitor → action rate.
- Where people come from (sources table).
- Keep the dashboard small; three to five numbers is fine.

## Metrics every site gets

Unless the owner says no:
- **The north star with its rate.**
- **Non-brand Google clicks** (if Search Console is connected).
- **Visits from AI assistants**: referrals from chatgpt.com, chat.openai.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com. Small today for most sites, and the owner will want to see it move. This is the number fecto:ai-search works on.

## Recipes per source

Event names below are common defaults; the site's real names come from `--discover`.

### Search Console (`gsc`)
- Non-brand clicks: `{"metric": "clicks", "filters": [{"dimension": "query", "operator": "excludingRegex", "expression": "acme|acme ?corp|acme\\.com"}]}`
- Brand clicks: same filter with `includingRegex`.
- Clicks to one section: `{"dimension": "page", "operator": "includingRegex", "expression": "/blog/"}`.
- CTR and position are averaged by Google over impressions; give position `"format": "decimal", "goodWhen": "down"` and CTR `"format": "percent"`.
- Opportunity table: `{"dimension": "query", "positionRange": [4, 15], "sortBy": "impressions"}`.

### GA4 (`ga4`)
- Sessions: `{"metric": "sessions"}`; people: `activeUsers`; engaged sessions: `engagedSessions`.
- A key event: `{"metric": "eventCount", "eventName": "generate_lead"}`; all key events: `{"metric": "keyEvents"}`.
- Revenue: `{"metric": "purchaseRevenue"}` (`format: "currency"`); orders: `{"metric": "transactions"}`.
- Session conversion rate: `{"metric": "sessionKeyEventRate"}` (`format: "percent"`).
- AI assistants: `{"metric": "sessions", "dimensionFilter": {"filter": {"fieldName": "sessionSource", "stringFilter": {"matchType": "PARTIAL_REGEXP", "value": "chatgpt|openai|perplexity|claude\\.ai|gemini|copilot"}}}}`
- Mobile: `{"filter": {"fieldName": "deviceCategory", "stringFilter": {"value": "mobile"}}}`.
- Tables: `{"dimensions": ["sessionSourceMedium"], "metrics": ["sessions", "keyEvents"]}`, `{"dimensions": ["landingPagePlusQueryString"], "metrics": ["sessions", "keyEvents"]}`, `{"dimensions": ["itemName"], "metrics": ["itemRevenue"]}`.

### PostHog (`posthog`)
- Visitors: `{"select": "count(distinct person_id)", "where": "event = '$pageview'"}`
- Sessions: `{"select": "count(distinct properties.$session_id)", "where": "event = '$pageview'"}`
- An event: `{"select": "count()", "where": "event = 'signed_up'"}`; people who did it: `count(distinct person_id)`.
- Revenue on an event: `{"select": "sum(toFloat(properties.revenue))", "where": "event = 'purchase'"}` (check the property name).
- Phone taps via autocapture: `{"select": "count()", "where": "event = '$autocapture' AND elements_chain_href LIKE 'tel:%'"}`
- Mobile only: add `AND properties.$device_type = 'Mobile'`.
- AI assistants: `{"select": "count(distinct properties.$session_id)", "where": "event = '$pageview' AND match(properties.$referring_domain, 'chatgpt\\\\.com|openai\\\\.com|perplexity\\\\.ai|claude\\\\.ai|gemini\\\\.google\\\\.com|copilot\\\\.microsoft\\\\.com')"}`
- Activation within 7 days (cohort of the period's signups):
  `{"select": "count(distinct person_id)", "where": "event = 'project_created' AND person_id IN (SELECT person_id FROM events WHERE event = 'signed_up' AND timestamp >= now() - INTERVAL 35 DAY)"}` is approximate; for an exact rate write a table query or a custom source.
- Table (top landing pages by signups):
  ```json
  {"hogql": "SELECT properties.$pathname AS page, count(distinct person_id) AS visitors FROM events WHERE event = '$pageview' AND timestamp >= {from} AND timestamp < {to} GROUP BY page ORDER BY visitors DESC LIMIT 10",
   "columns": [{"key": "page", "label": "Page", "format": "text"}, {"key": "visitors", "label": "Visitors", "format": "number"}]}
  ```

### Plausible (`plausible`)
- Visitors: `{"metric": "visitors"}`; a goal: `{"metric": "events", "filters": [["is", "event:goal", ["Signup"]]]}`; goal conversion rate: `{"metric": "conversion_rate", "filters": [["is", "event:goal", ["Signup"]]]}` (`format: "percent"`).
- AI assistants: `{"metric": "visitors", "filters": [["contains", "visit:source", ["chatgpt", "perplexity", "claude", "gemini", "copilot"], {"case_sensitive": false}]]}`
- Tables: `{"dimensions": ["visit:source"]}`, `{"dimensions": ["visit:entry_page"], "metrics": ["visitors", "conversion_rate"]}`.

### Stripe (`stripe`)
- `revenue` (`format: "currency"`, set `"currency": "usd"` on the item for display), `payments`, `new_customers`, `mrr` and `active_subscriptions` (snapshots: no comparison), table `top_customers`.
- Average order value: a ratio of `revenue` over `payments`, `format: "currency"`.
