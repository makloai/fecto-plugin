---
name: move-to-code
description: Move a website from Wix, Squarespace or Webflow into a code repo the owner controls, so fixes the builder can't make become possible. Use when the user wants to move off Wix, Squarespace or Webflow, rebuild their site in code, or when a Fecto step is blocked because the builder can't do it. Fecto lists every live page and what must survive, then compares the rebuilt copy page by page before the domain moves; Fecto hosts nothing. Needs the Fecto MCP server.
---

# Move a no-code site into code (only if the owner wants it)

Fecto hosts nothing. You rebuild the site here and deploy it on a host the owner signs up for. Fecto lists what must survive and compares the new copy with the live site before the domain moves.

If get_skill("move-to-code") returns a newer version of this skill, follow that one.

## Steps
1. Tell the owner what changes first: they edit the site through the repo, not the builder; the builder's store, members area or built-in forms need a replacement. Go on only with their yes.
2. `get_rebuild_inventory` lists every live page and what must survive (title, heading, forms, booking widgets, contact links, images), the business facts, the tag, and the rules.
3. Rebuild in a new repo (static HTML or a simple framework that serves full HTML). Keep every path. Use the site's own text and images; don't copy the builder's scripts. Give every form a real handler. Add the Fecto tag and the fixes from the plan.
4. The owner creates the host account and signs in themselves (`npx vercel login`, `npx netlify login`, `npx wrangler login`); you never create accounts or type passwords. Deploy to a preview address.
5. `compare_rebuild` with that address. Fix every blocker and show the owner the notes.
6. Only when it passes, the owner points the domain at the new host. They keep the builder plan 30 days; undo = point the domain back. Then `check_tag` and `scan_site` with refresh: true.

## Never
- Create accounts, enter passwords or move the domain yourself.
- Drop a page, form, booking widget or contact link the inventory lists.
