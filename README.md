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
| [plan-mode](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/plan-mode) (Official) | Read-only exploration mode for safe code analysis |
| [pi-markdown-preview](https://github.com/omaclaren/pi-markdown-preview) | Render Markdown/LaTeX to PDF, HTML, or PNG |

### Safety

| Extension | Description |
| -- | -- |
| [pi-guardrails](https://github.com/aliou/pi-guardrails) | Permission gates for dangerous operations (git push, rm, etc.) |
| [pi-rewind](https://github.com/arpagon/pi-rewind) | Per-turn snapshots, `/rewind` undo, `Esc+Esc` quick revert |

### Subagent Workflow

| Extension | Description |
| -- | -- |
| [pi-subagents](https://github.com/tintinweb/pi-subagents) | Claude Code-style autonomous sub-agents with parallel execution |
| [pi-observational-memory](https://github.com/elpapi42/pi-observational-memory) | Session-long memory across compactions and handoffs |

### Context & Cache

| Extension | Description |
| -- | -- |
| [pi-cache-optimizer](https://github.com/jiangge/pi-cache-optimizer) | Improve provider-side KV/prompt cache hit rates |
| [pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer) | Filter and compress command output before it hits LLM context |

### Search & Analysis

| Extension | Description |
| -- | -- |
| [pi-fff](https://github.com/dmtrKovalenko/fff) | Fuzzy file finding & indexed content grep via FFF engine |
| [pi-codegraph](https://github.com/vndv/pi-codegraph) | Symbol-level code navigation: callers, callees, impact analysis |

### Interaction

| Extension | Description |
| -- | -- |
| [ask-user-question](https://github.com/juicesharp/rpiv-mono) | Structured Q&A — LLM asks you instead of guessing |

### Skills

| Extension | Description |
| -- | -- |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Keep the agent from over-engineering — stdlib first, skip abstractions, delete over add |
