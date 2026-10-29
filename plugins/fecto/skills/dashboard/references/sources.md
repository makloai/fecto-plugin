# Connecting the sources

Each source reads with the owner's own credentials, from their computer, straight from the provider. Nothing passes through Fecto. Give the owner the steps for their sources only, and let them put keys into `fecto-dashboard/.env` themselves where possible: a key pasted into the chat leaves their machine.

Ask for read-only access every time. The dashboard never writes.

## Contents
- Finding which sources the site uses
- Google (Search Console and GA4)
- PostHog
- Plausible
- Stripe
- Anything else (custom sources, manual numbers)

## Finding which sources the site uses

Search the repo before asking:
- PostHog: `posthog-js`, `posthog.init`, `phc_`, `NEXT_PUBLIC_POSTHOG`. The init call's `api_host` tells you US (`us.i.posthog.com` → app `https://us.posthog.com`), EU (`eu.i.posthog.com` → `https://eu.posthog.com`), or self-hosted (a reverse proxy path like `/ingest` hides it; ask).
- GA4: `gtag(`, `G-XXXXXXX`, `@next/third-parties/google`, `GoogleAnalytics`, Google Tag Manager `GTM-`.
- Plausible: `plausible.io/js`, `next-plausible`, `data-domain=`.
- Stripe: `stripe`, `@stripe/stripe-js`, `checkout.sessions.create`, `STRIPE_SECRET_KEY`.
- Search Console has no trace in code (except maybe a `google-site-verification` meta tag); ask whether the owner has it. Most site owners do.
- Also note other tools you see (Shopify, HubSpot, Calendly, Cal.com, Mailchimp, Vercel Analytics, Umami, Fathom): they may hold the money action.

## Google (Search Console and GA4)

Two ways; offer the first unless the owner already uses gcloud.

**A. Service account (works everywhere, no browser prompts later)**
1. In Google Cloud console (any project): APIs & Services → enable "Google Search Console API", "Google Analytics Data API" and "Google Analytics Admin API".
2. IAM & Admin → Service accounts → Create → no roles needed → Keys → Add key → JSON. Save the file outside the repo, e.g. `~/.config/fecto/dashboard-sa.json`.
3. Search Console → Settings → Users and permissions → Add user → the service account's email, permission "Restricted".
4. GA4 → Admin → Property access management → + → the same email, role "Viewer".
5. In `.env`: `GOOGLE_APPLICATION_CREDENTIALS=/Users/<them>/.config/fecto/dashboard-sa.json`.

Some Google Workspace organisations forbid service account keys; then use B.

**B. The owner's own Google sign-in, through gcloud**
```
gcloud auth application-default login \
  --scopes=openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/analytics.readonly
gcloud auth application-default set-quota-project <a project with the three APIs enabled>
```
Leave `GOOGLE_APPLICATION_CREDENTIALS` empty; the fetcher reads gcloud's saved sign-in. If Google shows "This app is blocked" for these scopes, the owner needs their own OAuth client (`--client-id-file=client_secret.json`, a Desktop app client from APIs & Services → Credentials) or option A.

**IDs**: `node fetch.mjs --discover` lists Search Console properties (`sc-domain:example.com` for a domain property, `https://www.example.com/` for a URL-prefix one; use exactly what it prints) and GA4 properties (the numeric `propertyId`). With `ga4.propertyId` set, it also lists the last 30 days of events and which are key events.

**Gotchas**: Search Console data stops 3 days ago (the last days are incomplete) and is in Pacific time. GA4 uses the property's time zone. GA4 calls conversions "key events" (`keyEvents`, `sessionKeyEventRate`); the older `conversions` metric may be rejected.

## PostHog

1. PostHog → Settings (avatar menu) → Personal API keys → Create. Scope: the one project, "Query: Read" (if offered: "Project: Read" too, so `--discover` can list projects).
2. In `.env`: `POSTHOG_PERSONAL_API_KEY=phx_...`
3. Config: `"posthog": {"host": "https://us.posthog.com", "projectId": "<id>"}`. The id is in the project's URL (`/project/12345`) or `--discover`.

The `phc_` key in the site's code only sends events and can't read them.

**Gotchas**: dates use the project's time zone. `person_id` counts people, `properties.$session_id` counts sessions. The query API is rate limited; the fetcher makes three queries per metric, fine for a dashboard of under ~30 metrics. Autocaptured clicks live in `$autocapture` events; link targets are in `elements_chain_href`, link text in `elements_chain_texts`.

## Plausible

1. Plausible → Settings (account) → API keys → New key, type "Stats API".
2. In `.env`: `PLAUSIBLE_API_KEY=...`
3. Config: `"plausible": {"siteId": "example.com"}`, plus `"host"` if self-hosted.

Goals must already exist in Plausible to filter on them; `--discover` lists the goals with conversions in the last 30 days.

## Stripe

1. Stripe dashboard → Developers → API keys → Create restricted key. Read on: Balance, Customers, Subscriptions (and Charges if you want the top customers table). Everything else: None.
2. In `.env`: `STRIPE_API_KEY=rk_live_...`
3. Config: `"stripe": {}`.

**Gotchas**: revenue is payments minus refunds in the settlement currency, before Stripe fees. MRR is list prices of active subscriptions, before discounts and tax; label it "MRR (list price)" if the business uses coupons heavily. Busy accounts (5,000+ payments in a period) need a shorter `periodDays`.

## Anything else

**Custom source**: when the money action lives elsewhere (Shopify orders, HubSpot deals, Cal.com bookings, a database the owner can read, a CSV export), write `fecto-dashboard/sources/<name>.mjs` exporting the same functions as the built-in adapters, register it once in the config as `"sources": {"<name>": {"module": "./sources/<name>.mjs", ...its settings}}`, and use `"source": "<name>"` on items:

```js
// spec is the item's "spec"; range is { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } inclusive;
// ctx has env (from .env), dir, sources (the config's "sources"), and memo(key, fn).
export async function total(spec, range, ctx) { return 0; }          // number for the whole range
export async function daily(spec, range, ctx) { return []; }         // [{ date: 'YYYY-MM-DD', value }]
export async function table(spec, range, ctx) { return { columns: [], rows: [] }; } // only if used
export async function discover(ctx) { return {}; }                   // optional
export const lagDays = 1;                                            // optional, days of incomplete data
```
`import { request, need } from './http.mjs'` gives JSON requests with readable errors. Use the provider's read-only key, from `.env`.

**Manual number**: something no API holds (calls logged on paper, walk-ins). `{"source": "manual", "value": 42, "previousValue": 37, "note": "From the front desk log, updated by hand."}`. It doesn't refresh; say so on the card.
