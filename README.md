# makloai plugins

makloai's marketplace of plugins for Claude Code and Codex.

| Plugin | What it does |
| --- | --- |
| [fecto](plugins/fecto) | Fix your website for a result you pay for only when Fecto's published checks prove it on the live site. |

## Install

Claude Code:

```
claude plugin marketplace add makloai/plugins
claude plugin install fecto@makloai
```

Codex:

```
codex plugin marketplace add makloai/plugins
codex plugin add fecto@makloai
```

Each plugin's README covers its setup after install.

## Layout

```
.claude-plugin/marketplace.json   the marketplace: one entry per plugin
plugins/<name>/                   one plugin each
  .claude-plugin/plugin.json
  skills/, .mcp.json, README.md, ...
```

To add a plugin, create `plugins/<name>/` with its own `.claude-plugin/plugin.json`, add an entry with `"source": "./plugins/<name>"` to `.claude-plugin/marketplace.json`, and check with:

```
claude plugin validate --strict .
```
