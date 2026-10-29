// JSON over HTTP with errors that say what the API said, never the key that was sent.
export async function request(url, { method = 'GET', headers = {}, body, form } = {}) {
  const init = { method, headers: { Accept: 'application/json', ...headers } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  } else if (form) {
    init.body = new URLSearchParams(form).toString();
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = undefined;
  }
  if (!res.ok) {
    const detail =
      json?.error?.message || json?.error_description || json?.detail || json?.error || text.slice(0, 300);
    throw new Error(`${new URL(url).host} ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }
  if (json === undefined) throw new Error(`${new URL(url).host} returned non-JSON: ${text.slice(0, 200)}`);
  return json;
}

export function need(value, message) {
  if (value === undefined || value === null || value === '') throw new Error(message);
  return value;
}
