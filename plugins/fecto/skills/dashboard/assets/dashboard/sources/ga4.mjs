// Google Analytics 4: Data API runReport.
// spec (kpi):   { "metric": "sessions", "eventName": "generate_lead" }       eventName is a shortcut filter
//               { "metric": "sessions", "dimensionFilter": { ...GA4 FilterExpression... } }
// spec (table): { "dimensions": ["sessionSourceMedium"], "metrics": ["sessions", "keyEvents"],
//                 "limit": 10, "orderBy": "sessions", "dimensionFilter": {...} }
// Rates (engagementRate, sessionKeyEventRate, bounceRate) come back as fractions 0..1.
import { googleRequest } from './google-auth.mjs';
import { need } from './http.mjs';

function property(ctx) {
  return need(ctx.sources.ga4?.propertyId, 'Set sources.ga4.propertyId (numbers only); --discover lists them.');
}

function filterFor(spec) {
  const parts = [];
  if (spec.eventName) {
    parts.push({ filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: spec.eventName } } });
  }
  if (spec.dimensionFilter) parts.push(spec.dimensionFilter);
  if (!parts.length) return undefined;
  return parts.length === 1 ? parts[0] : { andGroup: { expressions: parts } };
}

function run(ctx, body) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${property(ctx)}:runReport`;
  return ctx.memo(`ga4:${url}:${JSON.stringify(body)}`, () => googleRequest(ctx, url, { method: 'POST', body }));
}

export async function total(spec, range, ctx) {
  const res = await run(ctx, {
    dateRanges: [{ startDate: range.from, endDate: range.to }],
    metrics: [{ name: need(spec.metric, 'GA4 spec needs "metric"') }],
    dimensionFilter: filterFor(spec),
  });
  return Number(res.rows?.[0]?.metricValues?.[0]?.value ?? 0);
}

export async function daily(spec, range, ctx) {
  const res = await run(ctx, {
    dateRanges: [{ startDate: range.from, endDate: range.to }],
    metrics: [{ name: spec.metric }],
    dimensions: [{ name: 'date' }],
    dimensionFilter: filterFor(spec),
    limit: 1000,
  });
  return (res.rows || []).map((r) => {
    const d = r.dimensionValues[0].value;
    return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, value: Number(r.metricValues[0].value) };
  });
}

export async function table(spec, range, ctx) {
  const dimensions = spec.dimensions || ['sessionSourceMedium'];
  const metrics = spec.metrics || ['sessions'];
  const res = await run(ctx, {
    dateRanges: [{ startDate: range.from, endDate: range.to }],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    dimensionFilter: filterFor(spec),
    orderBys: [{ metric: { metricName: spec.orderBy || metrics[0] }, desc: true }],
    limit: spec.limit || 10,
  });
  const formats = spec.formats || {};
  return {
    columns: [
      ...dimensions.map((d) => ({ key: d, label: d, format: 'text' })),
      ...metrics.map((m) => ({ key: m, label: m, format: formats[m] || (/Rate$/.test(m) ? 'percent' : 'number') })),
    ],
    rows: (res.rows || []).map((r) => ({
      ...Object.fromEntries(dimensions.map((d, i) => [d, r.dimensionValues[i].value])),
      ...Object.fromEntries(metrics.map((m, i) => [m, Number(r.metricValues[i].value)])),
    })),
  };
}

export async function discover(ctx) {
  const out = {};
  const accounts = await googleRequest(ctx, 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries');
  out.properties = (accounts.accountSummaries || []).flatMap((a) =>
    (a.propertySummaries || []).map((p) => ({
      account: a.displayName,
      propertyId: p.property.replace('properties/', ''),
      name: p.displayName,
    })),
  );
  if (ctx.sources.ga4?.propertyId) {
    const id = property(ctx);
    const events = await googleRequest(ctx, `https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`, {
      method: 'POST',
      body: {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'keyEvents' }],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 50,
      },
    });
    out.eventsLast30Days = (events.rows || []).map((r) => ({
      event: r.dimensionValues[0].value,
      count: Number(r.metricValues[0].value),
      keyEvents: Number(r.metricValues[1].value),
    }));
  }
  return out;
}
