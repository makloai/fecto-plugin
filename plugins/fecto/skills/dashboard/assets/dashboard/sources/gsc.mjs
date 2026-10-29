// Google Search Console: Search Analytics API.
// spec (kpi):   { "metric": "clicks" | "impressions" | "ctr" | "position", "filters": [...], "type": "web" }
// spec (table): { "dimension": "query" | "page" | "country" | "device", "metrics": ["clicks", ...],
//                 "filters": [...], "limit": 10, "sortBy": "clicks", "positionRange": [4, 15] }
// filters: Search Console dimension filters, e.g.
//   { "dimension": "query", "operator": "excludingRegex", "expression": "acme|acme corp" }
import { googleRequest } from './google-auth.mjs';
import { need } from './http.mjs';

// Search Console's last ~2 days are incomplete; stop before them so the comparison is fair.
export const lagDays = 3;

const COLUMNS = { clicks: 'number', impressions: 'number', ctr: 'percent', position: 'decimal' };

function siteUrl(ctx) {
  return need(ctx.sources.gsc?.siteUrl, 'Set sources.gsc.siteUrl (e.g. "sc-domain:example.com"); --discover lists them.');
}

function query(ctx, range, { dimensions = [], filters, type = 'web', rowLimit = 1000 } = {}) {
  const body = {
    startDate: range.from,
    endDate: range.to,
    dimensions,
    type,
    rowLimit,
    dataState: 'final',
    ...(filters?.length ? { dimensionFilterGroups: [{ filters }] } : {}),
  };
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl(ctx))}/searchAnalytics/query`;
  return ctx.memo(`gsc:${url}:${JSON.stringify(body)}`, () =>
    googleRequest(ctx, url, { method: 'POST', body }).then((r) => r.rows || []),
  );
}

function pick(row, metric) {
  if (!(metric in COLUMNS)) throw new Error(`Search Console metric must be one of ${Object.keys(COLUMNS).join(', ')}`);
  return row?.[metric] ?? (metric === 'clicks' || metric === 'impressions' ? 0 : null);
}

export async function total(spec, range, ctx) {
  const rows = await query(ctx, range, { filters: spec.filters, type: spec.type });
  return pick(rows[0], spec.metric || 'clicks');
}

export async function daily(spec, range, ctx) {
  const rows = await query(ctx, range, { dimensions: ['date'], filters: spec.filters, type: spec.type });
  return rows.map((r) => ({ date: r.keys[0], value: pick(r, spec.metric || 'clicks') }));
}

export async function table(spec, range, ctx) {
  const dimension = spec.dimension || 'query';
  const metrics = spec.metrics || ['clicks', 'impressions', 'ctr', 'position'];
  let rows = await query(ctx, range, { dimensions: [dimension], filters: spec.filters, type: spec.type });
  if (spec.positionRange) {
    const [lo, hi] = spec.positionRange;
    rows = rows.filter((r) => r.position >= lo && r.position <= hi);
  }
  const sortBy = spec.sortBy || 'clicks';
  rows = [...rows].sort((a, b) => (sortBy === 'position' ? a.position - b.position : b[sortBy] - a[sortBy]));
  return {
    columns: [{ key: dimension, label: dimension, format: 'text' }, ...metrics.map((m) => ({ key: m, label: m, format: COLUMNS[m] }))],
    rows: rows.slice(0, spec.limit || 10).map((r) => ({ [dimension]: r.keys[0], ...Object.fromEntries(metrics.map((m) => [m, r[m]])) })),
  };
}

export async function discover(ctx) {
  const res = await googleRequest(ctx, 'https://www.googleapis.com/webmasters/v3/sites');
  return { properties: (res.siteEntry || []).map((s) => ({ siteUrl: s.siteUrl, permission: s.permissionLevel })) };
}
