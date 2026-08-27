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

    <details><summary>Easier clone for CN user</summary>

    ```sh
    git clone https://gh-proxy.org/https://github.com/jalaxy33/pi-dotfiles ~/.pi
    ```
    </details>

3. (Optional) If you want to the same [skills I'm using](https://github.com/jalaxy33/skills-using):
 
    ```sh
    # (optional) backup ~/.agents
    mv ~/.agents ~/.agents-bak

    # clone skills repo
    git clone https://github.com/jalaxy33/skills-using ~/.agents

    # update skills to latest
    npx skills update -g
    ```

    pi will load skills from `~/.agents/skills/` automatically.


## Design Philosophy

### Principles

- **Fit my workflow, not for everyone** — solve real needs, not chase universality
- **Extend for what's missing** — MCP, sub-agents, tasks, vision — added via community extensions
- **Restrained yet flexible safety** — guard only irreversible operations (git push, delete), no noisy prompts

### Deliberately Unused

- **Plan mode** — no need to lock agent in read-only. Write plans to files, execute with the task and subagent extension
- **Goal mode** — not useful enough
- **Background bash** — barely used
- **pi-mcp-adapter** — MCP server integration kept installed but disabled; not needed for my current workflow. Re-enable anytime by dropping the negative filters in `agent/settings.json`.
- **pi-multimodal-proxy** - Not necessary for most models I'm using support are multimodal.

## Extension list

### Core

| Extension | Description |
| -- | -- |
| [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) | MCP server integration for Pi — ⚠ installed but disabled |
| [pi-web-access](https://github.com/nicobailon/pi-web-access) | Web search, content extraction, video understanding |
| [pi-markdown-preview](https://github.com/omaclaren/pi-markdown-preview) | Render Markdown/LaTeX to PDF, HTML, or PNG (requires: [pandoc](https://pandoc.org/installing.html), any Chromium-based browser, [mermaid-cli](https://github.com/mermaid-js/mermaid-cli)) |

> **Note:** `pi-mcp-adapter` is installed but deliberately disabled. Re-enable by removing the negative filters.

### Vision & Media

| Extension | Description |
| -- | -- |
| [pi-multimodal-proxy](https://github.com/pungggi/pi-multimodal-proxy) | Let non-vision models understand images via a vision model |

> **Note:** `pi-multimodal-proxy` is installed but deliberately disabled. Re-enable by removing the negative filters.

### Safety

| Extension | Description |
| -- | -- |
| [pi-guardrails](https://github.com/aliou/pi-guardrails) | Permission gates for dangerous operations (git push, rm, etc.) |

### Subagent & Memory

| Extension | Description |
| -- | -- |
| [pi-subagents](https://github.com/tintinweb/pi-subagents) | Claude Code-style autonomous sub-agents with parallel execution |
| [pi-blackhole](https://github.com/k0valik/pi-blackhole) | Unified algorithmic compaction + observational memory — deterministic zero-cost compaction with durable observations/reflections surviving compactions (merges [pi-vcc](https://github.com/sting8k/pi-vcc) + [pi-observational-memory](https://github.com/elpapi42/pi-observational-memory)) |
| [pi-tasks](https://github.com/tintinweb/pi-tasks) | Claude Code-style task tracking with dependency management and coordination |

### Context & Efficiency

| Extension | Description |
| -- | -- |
| [pi-cache-optimizer](https://github.com/jiangge/pi-cache-optimizer) | Improve provider-side KV/prompt cache hit rates |
| [pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer) | Filter and compress command output before it hits LLM context (requires: globally-installed [rtk](https://github.com/rtk-ai/rtk) and [ripgrep](https://github.com/burntsushi/ripgrep)) |

### Search & Navigation

| Extension | Description |
| -- | -- |
| [pi-fff](https://github.com/dmtrKovalenko/fff) | Fuzzy file finding & indexed content grep via FFF engine |
| [pi-codegraph](https://github.com/vndv/pi-codegraph) | Symbol-level code navigation: callers, callees, impact analysis (requires: globally-installed [codegraph](https://github.com/colbymchenry/codegraph)) |
| [pi-diff](https://github.com/heyhuynhgiabuu/pi-diff) | Syntax-highlighted git diff rendering (split & unified views) |
