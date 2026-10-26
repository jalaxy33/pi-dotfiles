# pi-subagent-bootstrap

Installs [badlogic/pi-subagent](https://github.com/badlogic/pi-subagent) and keeps its CLI available.

The upstream project is not published to npm. This wrapper fills that gap:

- On first load it clones the upstream repo into `vendor/pi-subagent` (gitignored).
- It links `vendor/pi-subagent/subagent.ts` to `<pi agent dir>/bin/subagent`.
- It loads the upstream extension, so `spawn`, `status`, `wait`, and the `/subagent` command work as usual.

Requires `git`, `tmux`, and Node.js 22.19 or newer (same as upstream). Pi adds its `bin` directory to the shell `PATH`, so `subagent` works inside pi without shell configuration.

## Network

Sources are tried in order:

1. The last source that worked, recorded in `.sync-state.json`.
2. Direct GitHub: `https://github.com/badlogic/pi-subagent.git`.
3. GitHub proxy: `https://gh-proxy.org/https://github.com/badlogic/pi-subagent.git`.

Each source is probed with `git ls-remote` before cloning, so a blocked GitHub connection falls back to the proxy.

Override with environment variables:

```sh
# Different fork
PI_SUBAGENT_REPO=github.com/owner/repo

# Custom mirror list; {repo} is replaced with PI_SUBAGENT_REPO
PI_SUBAGENT_MIRRORS='https://{repo}.git,https://gh-proxy.org/https://{repo}.git'

# Check for upstream updates at every pi start instead of once per day
PI_SUBAGENT_UPDATE=1

# Disable automatic update checks
PI_SUBAGENT_UPDATE=0

# Change the check interval (hours); 0 checks every start
PI_SUBAGENT_UPDATE_INTERVAL_HOURS=24
```

## Update

The wrapper checks for upstream updates at most once every 24 hours. The check runs before loading, so a new commit is used on that same start. If the check fails, the existing copy stays in use and the error is logged.

To force a clean install, delete `vendor/pi-subagent` from this directory and restart pi.
