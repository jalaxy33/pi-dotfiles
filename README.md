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

### Subagent Workflow

> Inspired by [this Reddit post](https://www.reddit.com/r/PiCodingAgent/comments/1t41thp/my_powerful_pi_agent_setup/).

| Extension | Description |
| -- | -- |
| [pi-fork](https://github.com/elpapi42/pi-fork) | Spawn isolated child agents for parallel exploration/review |
| [pi-observational-memory](https://github.com/elpapi42/pi-observational-memory) | Session-long memory across compactions and handoffs |
| [pi-minimal-subagent](https://github.com/elpapi42/pi-minimal-subagent) | Lightweight named subagent delegation |

### Context & Cache

| Extension | Description |
| -- | -- |
| [pi-cache-optimizer](https://github.com/jiangge/pi-cache-optimizer) | Improve provider-side KV/prompt cache hit rates |
| [pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer) | Filter and compress command output before it hits LLM context |
| [pi-caveman](https://github.com/jonjonrankin/pi-caveman) | Ultra-compressed agent responses (~75% output tokens) |

### Search

| Extension | Description |
| -- | -- |
| [pi-fff](https://github.com/dmtrKovalenko/fff) | Fuzzy file finding & indexed content grep via FFF engine |
