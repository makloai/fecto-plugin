# Set up Search Console access on your computer

Read this to the owner and ask which way is easiest. Every way but the last keeps the data on their computer.

**First, it may already be there.** The script finds service-account keys and a gcloud login on this machine by itself. If it found a service account that can't see this site, it prints that account's email: adding it as a user (step 6 of A) takes a minute, and one service account can read every site the owner adds it to.

## A. Your own service account (about 10 minutes once; each later site takes a minute)
1. Go to console.cloud.google.com with any Google account. Project picker (top bar) → New project, any name, e.g. "search-console-reader".
2. APIs & Services → Library → search "Google Search Console API" → Enable.
3. IAM & Admin → Service accounts → Create service account. Name: search-console-reader. Skip the optional steps → Done.
4. Open it → Keys → Add key → Create new key → JSON. A file downloads. Move it to `~/.config/search-console/key.json` and keep it private (`chmod 600`). It works like a password: never share it or put it in a repo.
5. Copy the service account's email (it ends in `.iam.gserviceaccount.com`).
6. Go to search.google.com/search-console → pick the site → Settings → Users and permissions → Add user → paste the email → Permission: Restricted → Add. Only an owner of the property can add users.
7. Tell your agent it's done. The script finds the key by itself.

If step 4 says key creation is disabled (a company Google Workspace policy), use B or C.

## B. gcloud (2 minutes, if gcloud is installed)
Run `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/cloud-platform` and sign in with the Google account that has the site in Search Console. If Google blocks the sign-in, use A or C.

## C. An export (2 minutes, no setup, a one-off snapshot)
Search Console → pick the site → Performance → Search results → Date: last 3 months → Export → Download CSV. Give your agent the file; it reads Queries.csv and Pages.csv. Repeat for fresh numbers.

## D. Sign in with Google on Fecto (last resort)
On fecto.ai, open the site → Data sources → Search Console → sign in with Google. Fecto then reads it for you, read-only, and the data goes through Fecto. Use it only if A to C don't work for you.
