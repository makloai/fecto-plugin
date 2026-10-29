// Access tokens for Search Console and GA4, from either:
//  - GOOGLE_APPLICATION_CREDENTIALS = a service account key file (added as a user on the
//    Search Console property and the GA4 property), or
//  - the owner's own sign-in: `gcloud auth application-default login --scopes=...`
//    (see references/sources.md), read from gcloud's default file.
import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { request } from './http.mjs';

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
];

let pending;
export function googleAuth(ctx) {
  pending ??= load(ctx);
  return pending;
}

async function load(ctx) {
  const file = credentialsFile(ctx);
  if (!file) {
    throw new Error(
      'No Google credentials. Set GOOGLE_APPLICATION_CREDENTIALS in .env to a service account key file, ' +
        'or sign in with gcloud application-default login (see references/sources.md).',
    );
  }
  const key = JSON.parse(readFileSync(file, 'utf8'));
  const headers = {};
  if (key.quota_project_id) headers['x-goog-user-project'] = key.quota_project_id;
  if (key.type === 'service_account') return { token: await serviceAccountToken(key), headers };
  if (key.type === 'authorized_user') return { token: await refreshToken(key), headers };
  throw new Error(`Unsupported Google credentials type "${key.type}" in ${file}.`);
}

function credentialsFile(ctx) {
  if (ctx.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const p = resolve(ctx.dir, ctx.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (!existsSync(p)) throw new Error(`GOOGLE_APPLICATION_CREDENTIALS points at ${p}, which doesn't exist.`);
    return p;
  }
  const adc =
    process.platform === 'win32'
      ? join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json')
      : join(homedir(), '.config', 'gcloud', 'application_default_credentials.json');
  return existsSync(adc) ? adc : null;
}

async function serviceAccountToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const aud = key.token_uri || 'https://oauth2.googleapis.com/token';
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email,
    scope: SCOPES.join(' '),
    aud,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const res = await request(aud, {
    method: 'POST',
    form: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` },
  });
  return res.access_token;
}

async function refreshToken(key) {
  const res = await request('https://oauth2.googleapis.com/token', {
    method: 'POST',
    form: {
      grant_type: 'refresh_token',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: key.refresh_token,
    },
  });
  return res.access_token;
}

export async function googleRequest(ctx, url, options = {}) {
  const { token, headers } = await googleAuth(ctx);
  return request(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...headers, ...options.headers } });
}
