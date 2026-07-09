# Dotfiles for pi

Personal configuration and settings for [Pi Coding Agent](https://pi.dev/).

## Usage

1. (Optional) Backup existing `.pi` config folder:

   ```sh
   mv ~/.pi ~/.pi.bak
   ```

2. Clone remote configs to `~/.pi`:

   ```sh
   git clone https://github.com/jalaxy33/pi-dotfiles ~/.pi
   ```

## Design Philosophy

### Principles

- **Fit my workflow, not for everyone** — solve real needs, not chase universality
- **Extend for what's missing** — MCP, sub-agents, tasks, vision — added via community extensions
- **Restrained yet flexible safety** — guard only irreversible operations (git push, delete), no noisy prompts

### Deliberately Unused

- **Plan mode** — no need to lock agent in read-only. Write plans to files, execute with the task and subagent extension
- **Goal mode** — not useful enough
- **Background bash** — barely used

## Extension list

### Core

| Extension | Description |
| -- | -- |
| [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) | MCP server integration for Pi |
| [pi-web-access](https://github.com/nicobailon/pi-web-access) | Web search, content extraction, video understanding |
| [pi-markdown-preview](https://github.com/omaclaren/pi-markdown-preview) | Render Markdown/LaTeX to PDF, HTML, or PNG (requires: [pandoc](https://pandoc.org/installing.html), any Chromium-based browser, [mermaid-cli](https://github.com/mermaid-js/mermaid-cli)) |

### Vision & Media

| Extension | Description |
| -- | -- |
| [pi-multimodal-proxy](https://github.com/pungggi/pi-multimodal-proxy) | Let non-vision models understand images via a vision model |

### Safety

| Extension | Description |
| -- | -- |
| [pi-guardrails](https://github.com/aliou/pi-guardrails) | Permission gates for dangerous operations (git push, rm, etc.) |

### Subagent & Memory

| Extension | Description |
| -- | -- |
| [pi-subagents](https://github.com/tintinweb/pi-subagents) | Claude Code-style autonomous sub-agents with parallel execution |
| [pi-observational-memory](https://github.com/elpapi42/pi-observational-memory) | Session-long memory across compactions and handoffs |
| [pi-tasks](https://github.com/tintinweb/pi-tasks) | Claude Code-style task tracking with dependency management and coordination |

### Context & Efficiency

| Extension | Description |
| -- | -- |
| [pi-cache-optimizer](https://github.com/jiangge/pi-cache-optimizer) | Improve provider-side KV/prompt cache hit rates |
| [pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer) | Filter and compress command output before it hits LLM context |
| [@pi-lab/env](https://github.com/pi-lab/pi-env) | Load env vars for pi from `settings.json` and `~/.pi/agent/.env` |

### Search & Navigation

| Extension | Description |
| -- | -- |
| [pi-fff](https://github.com/dmtrKovalenko/fff) | Fuzzy file finding & indexed content grep via FFF engine |
| [pi-codegraph](https://github.com/vndv/pi-codegraph) | Symbol-level code navigation: callers, callees, impact analysis (requires: globally-installed [codegraph](https://github.com/colbymchenry/codegraph)) |
| [pi-diff](https://github.com/heyhuynhgiabuu/pi-diff) | Syntax-highlighted git diff rendering (split & unified views) |
