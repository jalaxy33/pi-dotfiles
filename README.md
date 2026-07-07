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

## Extension list

### Core

| Extension | Description |
| -- | -- |
| [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) | MCP server integration for Pi |
| [pi-web-access](https://github.com/nicobailon/pi-web-access) | Web search, content extraction, video understanding |
| [pi-markdown-preview](https://github.com/omaclaren/pi-markdown-preview) | Render Markdown/LaTeX to PDF, HTML, or PNG |

### Vision & Media

| Extension | Description |
| -- | -- |
| [pi-zai-mcp](https://github.com/fitchmultz/pi-zai-mcp) | Z.AI MCP tools — primarily vision MCP for image/video understanding on non-multimodal models |

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

### Behavior & Methodology

| Extension | Description |
| -- | -- |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Lazy senior dev mode — YAGNI enforcement, shortest-working-diff discipline |

### Context & Efficiency

| Extension | Description |
| -- | -- |
| [pi-cache-optimizer](https://github.com/jiangge/pi-cache-optimizer) | Improve provider-side KV/prompt cache hit rates |
| [pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer) | Filter and compress command output before it hits LLM context |

### Search & Navigation

| Extension | Description |
| -- | -- |
| [pi-fff](https://github.com/dmtrKovalenko/fff) | Fuzzy file finding & indexed content grep via FFF engine |
| [pi-codegraph](https://github.com/vndv/pi-codegraph) | Symbol-level code navigation: callers, callees, impact analysis |
| [pi-diff](https://github.com/heyhuynhgiabuu/pi-diff) | Syntax-highlighted git diff rendering (split & unified views) |
