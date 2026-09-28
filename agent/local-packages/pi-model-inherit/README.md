# pi-model-inherit

Models inherit values from a `default` block in `models.json`, so you write them once instead of per provider.

```jsonc
{
  "default": {
    "providers": {
      "*":   { "compat": { "sendSessionAffinityHeaders": true } },
      "ark": { "headers": { "x-team": "core" } }
    }
  },
  "providers": {
    "ark": { "apiKey": "$ARK_API_KEY" }
  }
}
```

## Why

`models.json` is per provider: the same `compat` or `headers` value has to be repeated for every provider that needs it. `default` adds one inheritance layer above `providers`.

## Precedence

```
default.providers["*"]
  → default.providers["<providerId>"]
    → providers["<providerId>"]
      → models[].compat
        → modelOverrides["<id>"]
```

Later entries win. A value written explicitly at any layer is never overwritten, including an explicit `false`. Object fields (`compat`, `headers`) merge key by key; every other field is replaced.

## Supported keys

| Key | How it is applied |
|---|---|
| `compat`, `headers` | Injected at the model and request layer. No provider is ever repackaged, and nothing is written to your provider entries. |
| `name`, `baseUrl`, `apiKey`, `api`, `oauth`, `authHeader` | Matched providers get a composed config, exactly as if you had written those keys in `providers` yourself. |
| `models`, `modelOverrides` | Not supported. They are definitions and overrides, not defaults. |

## Behaviour

- No `default` block: the extension does nothing at all.
- Valid block: silent.
- Broken block: at most one warning per session. Typos get a "did you mean", and wrong types, empty entries, and unknown keys are named. A silent typo is the one failure mode worth a message, because nothing else would reveal it.
- No commands, no own config file, no other output.

## Install

Local path, in `settings.json`:

```json
{ "packages": ["./local-packages/pi-model-inherit"] }
```

From npm, once published:

```bash
pi install npm:pi-model-inherit
```

Keep this package early in the `packages` array. Pi loads packages in that order and runs their `session_start` handlers in the same order, so an extension loaded before this one reads model `compat` before inheritance is applied and may report the inherited flags as missing. The fill also runs on `model_select` and on every model lookup through the registry, so a late position is usually only visible in the first render, never in the request itself.

## Test

```bash
npm test
```

## Note

Inherited `compat`/`headers` values live in the extension's inheritance layer, not in your provider entries. Removing the package removes them with it.
