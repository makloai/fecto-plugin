#!/usr/bin/env node
// Pulls every metric in dashboard.config.json from its source and writes data.js,
// which index.html renders. Needs Node 18+ and nothing else.
//
//   node fetch.mjs              refresh data.js
//   node fetch.mjs --discover   list what each configured source has (sites, properties, events)
//   node fetch.mjs --days 90    override the period length for this run

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const env = { ...loadEnv(join(DIR, '.env')), ...process.env };
const configPath = join(DIR, 'dashboard.config.json');
if (!existsSync(configPath)) fail(`No dashboard.config.json in ${DIR}.`);
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const ADAPTERS = {
  gsc: './sources/gsc.mjs',
  ga4: './sources/ga4.mjs',
  posthog: './sources/posthog.mjs',
  plausible: './sources/plausible.mjs',
  stripe: './sources/stripe.mjs',
};

const memo = new Map();
const ctx = {
  env,
  dir: DIR,
  sources: config.sources || {},
  // Identical requests (e.g. GSC clicks and impressions for the same range) are made once.
  memo(key, fn) {
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  },
};

const adapterCache = new Map();
async function adapterFor(item) {
  // A custom source names its module on the item, or once under "sources": { "shopify": { "module": ... } }.
  const path = item.module || ctx.sources[item.source]?.module || ADAPTERS[item.source];
  if (!path) throw new Error(`Unknown source "${item.source}"`);
  if (!adapterCache.has(path)) {
    adapterCache.set(path, import(pathToFileURL(resolve(DIR, path)).href));
  }
  return adapterCache.get(path);
}

if (flag('--discover')) {
  await discover();
} else {
  await build();
}

async function discover() {
  const names = Object.keys(config.sources || {});
  if (!names.length) fail('No sources in dashboard.config.json. Add at least one under "sources".');
  for (const name of names) {
    console.log(`\n== ${name} ==`);
    try {
      const adapter = await adapterFor({ source: name });
      if (!adapter.discover) {
        console.log('  (no discover for this source)');
        continue;
      }
      const out = await adapter.discover(ctx);
      console.log(JSON.stringify(out, null, 2));
    } catch (e) {
      console.log(`  error: ${e.message}`);
    }
  }
}

async function build() {
  const days = Number(option('--days') || config.periodDays || 28);
  const items = (config.sections || []).flatMap((s) => s.items || []);
  const byId = new Map(items.filter((i) => i.id).map((i) => [i.id, i]));
  const results = new Map();

  // Ratios read other metrics' results, so they run after everything else.
  const direct = items.filter((i) => i.source !== 'ratio');
  const ratios = items.filter((i) => i.source === 'ratio');

  await pool(direct, 4, async (item) => {
    results.set(item, await runItem(item, days));
  });
  for (const item of ratios) {
    results.set(item, ratio(item, byId, results));
  }

  const data = {
    site: config.site,
    siteType: config.siteType,
    moneyAction: config.moneyAction,
    periodDays: days,
    generatedAt: new Date().toISOString(),
    sections: (config.sections || []).map((s) => ({
      title: s.title,
      note: s.note,
      items: (s.items || []).map((item) => ({
        id: item.id,
        type: item.type || 'kpi',
        label: item.label,
        why: item.why,
        source: item.source,
        format: item.format || 'number',
        currency: item.currency,
        goodWhen: item.goodWhen || 'up',
        northStar: !!item.northStar,
        columns: item.columns,
        ...results.get(item),
      })),
    })),
  };

  writeFileSync(join(DIR, 'data.js'), `window.DASHBOARD = ${JSON.stringify(data, null, 2)};\n`);
  report(data);
}

async function runItem(item, days) {
  try {
    // A number the owner gave you that no API holds (e.g. phone calls from a call log).
    if (item.source === 'manual') {
      return { value: item.value ?? null, previousValue: item.previousValue ?? null, note: item.note };
    }
    const adapter = await adapterFor(item);
    const lag = adapter.lagDays ?? 1;
    const current = rangeEnding(daysAgo(lag), days);
    const previous = rangeEnding(shift(current.from, -1), days);

    if (item.type === 'table') {
      const table = await adapter.table(item.spec || {}, current, ctx);
      return { range: current, table };
    }
    if (adapter.isSnapshot?.(item.spec || {})) {
      return { range: current, snapshot: true, value: await adapter.total(item.spec || {}, current, ctx) };
    }
    const [value, previousValue, series] = await Promise.all([
      adapter.total(item.spec || {}, current, ctx),
      adapter.total(item.spec || {}, previous, ctx),
      adapter.daily(item.spec || {}, current, ctx).then((s) => fillDays(s, current, item.format)),
    ]);
    return { range: current, previousRange: previous, value, previousValue, series };
  } catch (e) {
    return { error: e.message };
  }
}

function ratio(item, byId, results) {
  const num = results.get(byId.get(item.numerator));
  const den = results.get(byId.get(item.denominator));
  if (!num || !den) return { error: `Ratio needs metrics "${item.numerator}" and "${item.denominator}" in the config.` };
  if (num.error || den.error) return { error: `Depends on a metric that failed: ${num.error || den.error}` };
  const div = (a, b) => (a == null || b == null || b === 0 ? null : a / b);
  const denByDate = new Map((den.series || []).map((p) => [p.date, p.value]));
  return {
    range: num.range,
    previousRange: num.previousRange,
    value: div(num.value, den.value),
    previousValue: div(num.previousValue, den.previousValue),
    series: (num.series || []).map((p) => ({ date: p.date, value: div(p.value, denByDate.get(p.date)) })),
    note: num.range?.to !== den.range?.to ? 'Numerator and denominator end on different days.' : undefined,
  };
}

function report(data) {
  const rows = [];
  for (const s of data.sections) {
    for (const i of s.items) {
      let shown;
      if (i.error) shown = `ERROR ${i.error}`;
      else if (i.type === 'table') shown = `${i.table?.rows?.length ?? 0} rows`;
      else shown = `${fmt(i.value)}${i.previousValue != null ? ` (prev ${fmt(i.previousValue)})` : ''}`;
      rows.push(`  ${(i.label || i.id).padEnd(32)} ${shown}`);
    }
  }
  console.log(`Wrote ${join(DIR, 'data.js')}\n${rows.join('\n')}`);
  const errors = data.sections.flatMap((s) => s.items).filter((i) => i.error).length;
  if (errors) console.log(`\n${errors} item(s) failed; the page shows them as errors.`);
}

// ---------- helpers ----------

function fmt(v) {
  if (v == null) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(4);
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function shift(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function rangeEnding(to, days) {
  return { from: shift(to, -(days - 1)), to };
}

// Days with no data come back missing; counts become 0, rates stay empty.
function fillDays(series, range, format) {
  const byDate = new Map((series || []).map((p) => [p.date, p.value]));
  const countLike = format === 'number' || format === 'currency' || format == null;
  const out = [];
  for (let d = range.from; d <= range.to; d = shift(d, 1)) {
    out.push({ date: d, value: byDate.has(d) ? byDate.get(d) : countLike ? 0 : null });
  }
  return out;
}

async function pool(items, size, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift());
    }),
  );
}

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
