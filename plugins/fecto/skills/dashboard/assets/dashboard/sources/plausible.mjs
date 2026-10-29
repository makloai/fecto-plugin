// Plausible: Stats API v2. Needs PLAUSIBLE_API_KEY (a Stats API key).
// spec (kpi):   { "metric": "visitors", "filters": [["is", "event:goal", ["Signup"]]] }
// spec (table): { "dimensions": ["visit:source"], "metrics": ["visitors"], "limit": 10, "filters": [...] }
// bounce_rate and conversion_rate come back from Plausible as 0..100; they're returned as 0..1 here.
import { request, need } from './http.mjs';

const PERCENT = new Set(['bounce_rate', 'conversion_rate', 'percentage', 'exit_rate']);
const scale = (m, v) => (v == null ? null : PERCENT.has(m) ? v / 100 : v);

function query(ctx, body) {
  const c = ctx.sources.plausible || {};
  const host = (c.host || 'https://plausible.io').replace(/\/$/, '');
  const key = need(ctx.env.PLAUSIBLE_API_KEY, 'Set PLAUSIBLE_API_KEY in .env.');
  const full = { site_id: need(c.siteId, 'Set sources.plausible.siteId (the domain as Plausible names it).'), ...body };
  return ctx.memo(`plausible:${JSON.stringify(full)}`, () =>
    request(`${host}/api/v2/query`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: full }),
  );
}

export async function total(spec, range, ctx) {
  const metric = spec.metric || 'visitors';
  const res = await query(ctx, { metrics: [metric], date_range: [range.from, range.to], filters: spec.filters });
  return scale(metric, res.results?.[0]?.metrics?.[0] ?? 0);
}

export async function daily(spec, range, ctx) {
  const metric = spec.metric || 'visitors';
  const res = await query(ctx, {
    metrics: [metric],
    date_range: [range.from, range.to],
    dimensions: ['time:day'],
    filters: spec.filters,
  });
  return (res.results || []).map((r) => ({ date: r.dimensions[0].slice(0, 10), value: scale(metric, r.metrics[0]) }));
}

export async function table(spec, range, ctx) {
  const dimensions = spec.dimensions || ['visit:source'];
  const metrics = spec.metrics || ['visitors'];
  const res = await query(ctx, {
    metrics,
    dimensions,
    date_range: [range.from, range.to],
    filters: spec.filters,
    order_by: [[metrics[0], 'desc']],
    pagination: { limit: spec.limit || 10 },
  });
  return {
    columns: [
      ...dimensions.map((d) => ({ key: d, label: d, format: 'text' })),
      ...metrics.map((m) => ({ key: m, label: m, format: PERCENT.has(m) ? 'percent' : m === 'visit_duration' ? 'duration' : 'number' })),
    ],
    rows: (res.results || []).map((r) => ({
      ...Object.fromEntries(dimensions.map((d, i) => [d, r.dimensions[i]])),
      ...Object.fromEntries(metrics.map((m, i) => [m, scale(m, r.metrics[i])])),
    })),
  };
}

export async function discover(ctx) {
  const res = await query(ctx, { metrics: ['visitors', 'events'], date_range: '30d', dimensions: ['event:goal'] });
  return { goalsLast30Days: (res.results || []).map((r) => ({ goal: r.dimensions[0], visitors: r.metrics[0], events: r.metrics[1] })) };
}
