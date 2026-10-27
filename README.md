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

3. (Optional) If you want to use the same [skills I'm using](https://github.com/jalaxy33/skills-using):

   ```sh
   # (optional) backup ~/.agents
   mv ~/.agents ~/.agents-bak

   # clone skills repo
   git clone https://github.com/jalaxy33/skills-using ~/.agents

   # update skills to latest
   npx skills update -g
   ```

   Skills in `~/.agents/skills/` are not auto-loaded; use `pi --skill <path>` when needed.

## Requirements

- [pi](https://pi.dev/)
- [bun](https://bun.sh) — the package installer pi uses (`npmCommand` in `agent/settings.json`)
- [tmux](https://github.com/tmux/tmux) — `pi-subagent`
- [pandoc](https://pandoc.org/installing.html), any Chromium-based browser, [mermaid-cli](https://github.com/mermaid-js/mermaid-cli) — `pi-markdown-preview`

## Design Philosophy

### Principles

- **Fit my workflow, not for everyone** — solve real needs, not chase universality
- **Extend for what's missing** — sub-agents, vision — added via community extensions
- **Restrained yet flexible safety** — guard only irreversible operations (git push, delete), no noisy prompts
- **Avoid unnecessary global context** — `~/.agents/skills/` are not auto-loaded, passed in with `pi --skill` when a task needs them

### Deliberately Unused

- **Plan mode** — no need to lock agent in read-only. Write plans to files, execute with the subagent extension and workflows
- **Goal mode** — not useful enough
- **Background bash** — barely used

## Extension list

### Core

| Extension | Description |
| -- | -- |
| [pi-web-access](https://github.com/nicobailon/pi-web-access) | Web search, content extraction, video understanding |
| [pi-subagent](https://github.com/badlogic/pi-subagent) | Observable persistent subagents in tmux. Installed by local [pi-subagent-bootstrap](./agent/local-packages/pi-subagent-bootstrap/README.md) (requires: [tmux](https://github.com/tmux/tmux)) |
| [pi-intercom](https://github.com/nicobailon/pi-intercom) | Session-to-session messaging between local pi sessions |

### Safety

| Extension | Description |
| -- | -- |
| [pi-guardrails](https://github.com/aliou/pi-guardrails) | Permission gates for dangerous operations (git push, rm, etc.) |

### Multimodal

| Extension | Description |
| -- | -- |
| [pi-multimodal-proxy](https://github.com/pungggi/pi-multimodal-proxy) | Let non-vision models understand images via a vision model |

### Context

| Extension | Description |
| -- | -- |
| [pi-context-view](https://github.com/dimk90/pi-context-view) | Show context usage map and inspect the hidden parts |

### UI

| Extension | Description |
| -- | -- |
| [pi-markdown-preview](https://github.com/omaclaren/pi-markdown-preview) | Preview conversation output with richer rendering (requires: [pandoc](https://pandoc.org/installing.html), any Chromium-based browser, [mermaid-cli](https://github.com/mermaid-js/mermaid-cli)) |

### Config Utils

| Extension | Description |
| -- | -- |
| [pi-model-inherit](https://github.com/jalaxy33/pi-model-inherit) | Simplify model customization by inheriting configs from existing models |
| [pi-private-models](https://github.com/jalaxy33/pi-private-models) | Hide private model configs from revealing to public |
