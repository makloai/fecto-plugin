// PostHog: HogQL through the query API. Needs POSTHOG_PERSONAL_API_KEY (phx_..., with
// query:read). The project key in the site's code (phc_...) can only send events, not read them.
// spec (kpi):   { "select": "count(distinct person_id)", "where": "event = '$pageview'" }
//               "from" defaults to events, "timestampField" to timestamp.
// spec (table): { "hogql": "SELECT ... FROM events WHERE timestamp >= {from} AND timestamp < {to} ...",
//                 "columns": [{ "key": "page", "label": "Page", "format": "text" }, ...] }
//               {from}/{to} become the period's bounds; result columns map to "columns" in order.
import { request, need } from './http.mjs';

function config(ctx) {
  const c = ctx.sources.posthog || {};
  return {
    host: (c.host || 'https://us.posthog.com').replace(/\/$/, ''),
    projectId: need(c.projectId, 'Set sources.posthog.projectId; --discover lists projects.'),
    key: need(ctx.env.POSTHOG_PERSONAL_API_KEY, 'Set POSTHOG_PERSONAL_API_KEY in .env (a personal API key, phx_...).'),
  };
}

async function hogql(ctx, query) {
  const { host, projectId, key } = config(ctx);
  return ctx.memo(`posthog:${query}`, () =>
    request(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: { query: { kind: 'HogQLQuery', query }, name: 'fecto-dashboard' },
    }),
  );
}

const nextDay = (d) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};
const bounds = (range) => ({ from: `toDateTime('${range.from} 00:00:00')`, to: `toDateTime('${nextDay(range.to)} 00:00:00')` });

function scoped(spec, range) {
  const ts = spec.timestampField || 'timestamp';
  const b = bounds(range);
  const where = [`${ts} >= ${b.from}`, `${ts} < ${b.to}`];
  if (spec.where) where.push(`(${spec.where})`);
  return { ts, from: spec.from || 'events', where: where.join(' AND ') };
}

export async function total(spec, range, ctx) {
  const { from, where } = scoped(spec, range);
  const res = await hogql(ctx, `SELECT ${need(spec.select, 'PostHog spec needs "select"')} FROM ${from} WHERE ${where}`);
  return Number(res.results?.[0]?.[0] ?? 0);
}

export async function daily(spec, range, ctx) {
  const { ts, from, where } = scoped(spec, range);
  const res = await hogql(ctx, `SELECT toDate(${ts}) AS d, ${spec.select} FROM ${from} WHERE ${where} GROUP BY d ORDER BY d`);
  return (res.results || []).map(([d, v]) => ({ date: String(d).slice(0, 10), value: Number(v) }));
}

export async function table(spec, range, ctx) {
  const b = bounds(range);
  const query = need(spec.hogql, 'PostHog table spec needs "hogql"').replaceAll('{from}', b.from).replaceAll('{to}', b.to);
  const res = await hogql(ctx, query);
  const columns = spec.columns || (res.columns || []).map((c) => ({ key: c, label: c, format: 'text' }));
  return {
    columns,
    rows: (res.results || []).map((row) => Object.fromEntries(columns.map((c, i) => [c.key, row[i]]))),
  };
}

export async function discover(ctx) {
  const c = ctx.sources.posthog || {};
  const host = (c.host || 'https://us.posthog.com').replace(/\/$/, '');
  const key = need(ctx.env.POSTHOG_PERSONAL_API_KEY, 'Set POSTHOG_PERSONAL_API_KEY in .env (a personal API key, phx_...).');
  const out = {};
  try {
    const projects = await request(`${host}/api/projects/`, { headers: { Authorization: `Bearer ${key}` } });
    out.projects = (projects.results || []).map((p) => ({ projectId: p.id, name: p.name, timezone: p.timezone }));
  } catch (e) {
    out.projects = `could not list (${e.message}); find the id in PostHog under Settings → Project`;
  }
  if (c.projectId) {
    const res = await hogql(
      ctx,
      "SELECT event, count() AS n, count(distinct person_id) AS people FROM events WHERE timestamp > now() - INTERVAL 30 DAY GROUP BY event ORDER BY n DESC LIMIT 60",
    );
    out.eventsLast30Days = (res.results || []).map(([event, n, people]) => ({ event, count: n, people }));
  }
  return out;
}
