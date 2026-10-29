// Stripe: read-only. Needs STRIPE_API_KEY, ideally a restricted key (rk_live_...) with Read on
// Balance, Customers and Subscriptions (and Charges for the top_customers table).
// spec (kpi): { "metric": "revenue" | "payments" | "new_customers" | "mrr" | "active_subscriptions",
//               "currency": "usd" }
//   revenue        payments minus refunds in the period, in major units (dollars, not cents)
//   payments       count of successful payments
//   new_customers  customers created in the period
//   mrr            monthly recurring revenue right now, before discounts and tax (snapshot)
//   active_subscriptions  active + trialing subscriptions right now (snapshot)
// spec (table): { "metric": "top_customers", "limit": 10, "currency": "usd" }   revenue by customer
import { request, need } from './http.mjs';

const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
const MAX_PAGES = 50;
const SNAPSHOTS = new Set(['mrr', 'active_subscriptions']);

export const isSnapshot = (spec) => SNAPSHOTS.has(spec.metric);

const major = (amount, currency) => (ZERO_DECIMAL.has(currency) ? amount : amount / 100);
const unix = (date, endOfDay) => Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000) + (endOfDay ? 86400 : 0);
const day = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);

async function list(ctx, path, params) {
  const key = need(ctx.env.STRIPE_API_KEY, 'Set STRIPE_API_KEY in .env (a restricted read-only key).');
  return ctx.memo(`stripe:${path}:${JSON.stringify(params)}`, async () => {
    const out = [];
    let after;
    for (let page = 0; page < MAX_PAGES; page++) {
      const qs = new URLSearchParams({ limit: '100', ...params, ...(after ? { starting_after: after } : {}) });
      const res = await request(`https://api.stripe.com/v1/${path}?${qs}`, { headers: { Authorization: `Bearer ${key}` } });
      out.push(...res.data);
      if (!res.has_more) return out;
      after = res.data.at(-1).id;
    }
    throw new Error(`More than ${MAX_PAGES * 100} ${path} in the period; shorten periodDays.`);
  });
}

function inRange(range) {
  return { 'created[gte]': String(unix(range.from)), 'created[lt]': String(unix(range.to, true)) };
}

// Balance transactions are in the account's settlement currency, so they add up across
// whatever currencies customers paid in.
async function money(ctx, range, spec) {
  const txns = await list(ctx, 'balance_transactions', inRange(range));
  const kept = txns.filter((t) => ['charge', 'payment', 'refund', 'payment_refund'].includes(t.type));
  const counts = new Map();
  for (const t of kept) counts.set(t.currency, (counts.get(t.currency) || 0) + 1);
  const currency = spec.currency || [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return kept.filter((t) => t.currency === currency);
}

async function events(spec, range, ctx) {
  switch (spec.metric) {
    case 'revenue':
      return (await money(ctx, range, spec)).map((t) => ({ created: t.created, value: major(t.amount, t.currency) }));
    case 'payments':
      return (await money(ctx, range, spec)).filter((t) => t.amount > 0).map((t) => ({ created: t.created, value: 1 }));
    case 'new_customers':
      return (await list(ctx, 'customers', inRange(range))).map((c) => ({ created: c.created, value: 1 }));
    default:
      throw new Error(`Unknown Stripe metric "${spec.metric}"`);
  }
}

export async function total(spec, range, ctx) {
  if (spec.metric === 'mrr') return mrr(ctx, spec);
  if (spec.metric === 'active_subscriptions') return (await subscriptions(ctx)).length;
  return (await events(spec, range, ctx)).reduce((sum, e) => sum + e.value, 0);
}

export async function daily(spec, range, ctx) {
  const byDay = new Map();
  for (const e of await events(spec, range, ctx)) byDay.set(day(e.created), (byDay.get(day(e.created)) || 0) + e.value);
  return [...byDay].map(([date, value]) => ({ date, value }));
}

async function subscriptions(ctx) {
  const [active, trialing] = await Promise.all([
    list(ctx, 'subscriptions', { status: 'active' }),
    list(ctx, 'subscriptions', { status: 'trialing' }),
  ]);
  return [...active, ...trialing];
}

async function mrr(ctx, spec) {
  const perMonth = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 };
  let sum = 0;
  for (const sub of await list(ctx, 'subscriptions', { status: 'active' })) {
    for (const item of sub.items?.data || []) {
      const price = item.price;
      if (!price?.recurring || price.unit_amount == null) continue;
      if (spec.currency && price.currency !== spec.currency) continue;
      sum += major(price.unit_amount * (item.quantity ?? 1), price.currency) * (perMonth[price.recurring.interval] / price.recurring.interval_count);
    }
  }
  return sum;
}

export async function table(spec, range, ctx) {
  if (spec.metric !== 'top_customers') throw new Error('Stripe tables support "top_customers" only');
  const charges = await list(ctx, 'charges', inRange(range));
  const byCustomer = new Map();
  for (const c of charges) {
    if (c.status !== 'succeeded' || (spec.currency && c.currency !== spec.currency)) continue;
    const who = c.billing_details?.email || c.customer || 'guest';
    byCustomer.set(who, (byCustomer.get(who) || 0) + major(c.amount - c.amount_refunded, c.currency));
  }
  return {
    columns: [
      { key: 'customer', label: 'Customer', format: 'text' },
      { key: 'revenue', label: 'Revenue', format: 'currency' },
    ],
    rows: [...byCustomer]
      .sort((a, b) => b[1] - a[1])
      .slice(0, spec.limit || 10)
      .map(([customer, revenue]) => ({ customer, revenue })),
  };
}

export async function discover(ctx) {
  const key = need(ctx.env.STRIPE_API_KEY, 'Set STRIPE_API_KEY in .env (a restricted read-only key).');
  const headers = { Authorization: `Bearer ${key}` };
  const out = {};
  try {
    const balance = await request('https://api.stripe.com/v1/balance', { headers });
    out.balanceCurrencies = [...new Set((balance.available || []).map((b) => b.currency))];
  } catch (e) {
    out.balanceCurrencies = `could not read (${e.message})`;
  }
  try {
    const subs = await request('https://api.stripe.com/v1/subscriptions?status=active&limit=1', { headers });
    out.hasActiveSubscriptions = subs.data.length > 0;
  } catch (e) {
    out.hasActiveSubscriptions = `could not read (${e.message})`;
  }
  return out;
}
