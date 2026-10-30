# Search Console script

Save as `gsc.py` and run it on the owner's computer. Python 3 with `pip install google-auth requests`.

```python
#!/usr/bin/env python3
"""Read a site's Google Search Console data on this computer. Nothing is sent to Fecto.

  python3 gsc.py example.com                      # find access, then top queries and pages, last 28 days
  python3 gsc.py example.com --key path/key.json  # use this service-account key
  python3 gsc.py example.com --by page --days 90
  python3 gsc.py example.com --page https://example.com/pricing --before-after 2026-10-01

Access is tried in this order: --key, $GOOGLE_APPLICATION_CREDENTIALS, service-account
key files in ~/.config, ~/.gcp, ~/.credentials, ~/Downloads and this folder, then gcloud's
application-default login. It prints which one worked (a path or "gcloud"), never a key.
Needs: pip install google-auth requests
"""
import argparse, datetime as dt, glob, json, os, sys
from urllib.parse import quote

import google.auth
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
API = "https://searchconsole.googleapis.com/webmasters/v3"


def key_files(explicit):
    if explicit:
        yield explicit
        return
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        yield os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
    for pattern in ("~/.config/**/*.json", "~/.gcp/*.json", "~/.credentials/*.json", "~/Downloads/*.json", "./*.json"):
        for path in sorted(glob.glob(os.path.expanduser(pattern), recursive=True)):
            try:
                if os.path.getsize(path) > 20_000:
                    continue
                with open(path) as f:
                    data = json.load(f)
                if isinstance(data, dict) and data.get("type") == "service_account" and data.get("private_key"):
                    yield path
            except (OSError, ValueError):
                continue


def candidates(explicit):
    seen = set()
    for path in key_files(explicit):
        if path in seen:
            continue
        seen.add(path)
        try:
            creds = service_account.Credentials.from_service_account_file(path, scopes=[SCOPE])
            yield path, creds.service_account_email, creds
        except (OSError, ValueError):
            continue
    if not explicit:
        try:
            yield "gcloud", None, google.auth.default(scopes=[SCOPE])[0]
        except Exception:
            pass


def find_access(domain, explicit):
    bare = domain.lower().strip().removeprefix("https://").removeprefix("http://").split("/")[0].removeprefix("www.")
    wanted = [f"sc-domain:{bare}", f"https://{bare}/", f"https://www.{bare}/", f"http://{bare}/", f"http://www.{bare}/"]
    tried = []
    for label, email, creds in candidates(explicit):
        try:
            session = AuthorizedSession(creds)
            res = session.get(f"{API}/sites", timeout=20)
            if res.status_code != 200:
                tried.append(f"{label}: Google said {res.status_code}")
                continue
            have = {e["siteUrl"] for e in res.json().get("siteEntry", [])}
            prop = next((p for p in wanted if p in have), None)
            if prop:
                return label, session, prop, tried
            tried.append(f"{label}: can't see {bare}" + (f"; to use it, add {email} as a Restricted user on the property" if email else ""))
        except Exception as e:  # a bad key or a blocked login should not stop the search
            tried.append(f"{label}: {type(e).__name__}")
    return None, None, None, tried


def query(session, prop, start, end, dims, page=None, limit=50):
    body = {"startDate": str(start), "endDate": str(end), "dimensions": dims, "rowLimit": limit}
    if page:
        body["dimensionFilterGroups"] = [{"filters": [{"dimension": "page", "operator": "equals", "expression": page}]}]
    res = session.post(f"{API}/sites/{quote(prop, safe='')}/searchAnalytics/query", json=body, timeout=30)
    res.raise_for_status()
    return res.json().get("rows", [])


def totals(rows):
    clicks = sum(r["clicks"] for r in rows)
    shown = sum(r["impressions"] for r in rows)
    return clicks, shown


def main():
    ap = argparse.ArgumentParser(description="Read Search Console data on this computer.")
    ap.add_argument("domain")
    ap.add_argument("--key", help="a service-account key file")
    ap.add_argument("--by", choices=["query", "page", "both"], default="both")
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--page", help="only this page URL")
    ap.add_argument("--before-after", metavar="DATE", help="28 days before vs 28 days after this date (YYYY-MM-DD)")
    ap.add_argument("--limit", type=int, default=50)
    args = ap.parse_args()

    label, session, prop, tried = find_access(args.domain, args.key)
    if not prop:
        print("No access to this site's Search Console on this computer.")
        for line in tried:
            print(" -", line)
        print("Next: ask the owner which way to set it up (the skill's references/search-console-setup.md).")
        sys.exit(2)

    last = dt.date.today() - dt.timedelta(days=3)  # Search Console lags about 3 days
    print(f"access: {label}   property: {prop}")

    if args.before_after:
        pivot = dt.date.fromisoformat(args.before_after)
        before = query(session, prop, pivot - dt.timedelta(days=28), pivot - dt.timedelta(days=1), [], args.page)
        after_end = min(pivot + dt.timedelta(days=27), last)
        after = query(session, prop, pivot, after_end, [], args.page)
        (bc, bi), (ac, ai) = totals(before), totals(after)
        print(f"before {pivot - dt.timedelta(days=28)}..{pivot - dt.timedelta(days=1)}: {bc} clicks, {bi} impressions")
        print(f"after  {pivot}..{after_end} ({(after_end - pivot).days + 1} days): {ac} clicks, {ai} impressions")
        return

    start = last - dt.timedelta(days=args.days - 1)
    print(f"period: {start} to {last}" + (f"   page: {args.page}" if args.page else ""))
    for dim in (["query", "page"] if args.by == "both" else [args.by]):
        print(f"\n# top {'queries' if dim == 'query' else 'pages'}\tclicks\timpressions\tposition")
        for r in query(session, prop, start, last, [dim], args.page, args.limit):
            print(f"{r['keys'][0]}\t{r['clicks']}\t{r['impressions']}\t{r['position']:.1f}")


if __name__ == "__main__":
    main()
```
