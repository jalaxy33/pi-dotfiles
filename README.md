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

### Necessary functionalities

| Extension | Description |
| -- | -- |
| [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) | Enable to use MCP servers with Pi |
| [pi-web-access](https://github.com/nicobailon/pi-web-access) | Web search, content extraction, and video understanding for Pi agent.  |
| [pi-subagents](https://github.com/nicobailon/pi-subagents) | lets Pi delegate work to focused child agents |
| [plan-mode](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/plan-mode) (Official) | Read-only exploration mode for safe code analysis. |

### Memory/Cache Optimization

| Extension | Description |
| -- | -- |
| [pi-cache-optimizer](https://github.com/jiangge/pi-cache-optimizer) | Improving provider-side KV / prompt cache hit rates.|
| [rtk](https://github.com/rtk-ai/rtk) | Filters and compresses command outputs before they reach your LLM context |

### Style & theme

| Extension | Description |
| -- | -- |
| [pi-powerline-footer](https://github.com/nicobailon/pi-powerline-footer) | Customizes the default pi editor with a powerline-style status bar |

### Permission & Safety

| Extension | Description |
| -- | -- |
| [permission-gate.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/permission-gate.ts) (Official) | Prompts for confirmation before dangerous bash commands (rm -rf, sudo, etc.) |
| [protected-paths.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/protected-paths.ts) (Official) | Blocks writes to protected paths (.env, .git/, node_modules/) |
| [confirm-destructive.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/confirm-destructive.ts) (Official) | Confirms before destructive session actions (clear, switch, fork) |
| [dirty-repo-guard.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/dirty-repo-guard.ts) (Official) | Prevents session changes with uncommitted git changes |
