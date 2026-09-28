# pi-model-inherit

**English** | [简体中文](./README.zh-CN.md)

Two additions to `models.json`:

1. `default` block: values every provider inherits.
2. `inherit` field: a model inherits another model's configuration.

Unused, it does nothing; a mistake only warns.

```jsonc
{
  // 1. default block: values every provider inherits
  "default": {
    "providers": {
      "*": { "compat": { "sendSessionAffinityHeaders": true } }
    }
  },
  "providers": {
    "my-gateway": {
      "baseUrl": "https://gateway.example/v1",
      "api": "openai-completions",
      "models": [
        // 2. inherit field: copy another model's configuration
        { "id": "glm-5.3", "inherit": "zai/glm-5.3" },
        // and may still override single fields
        { "id": "glm-5.3-fast", "inherit": "zai/glm-5.3", "maxTokens": 1000 }
      ]
    }
  }
}
```

## `default` block

Values every provider inherits. `"*"` covers all of them, a provider id narrows it.

```jsonc
{
  "default": {
    "providers": {
      "*": { "compat": { "sendSessionAffinityHeaders": true } },
      "my-gateway": { "headers": { "x-team": "core" } }
    }
  }
}
```

| Key | Applied |
|---|---|
| `compat`, `headers` | On models and on requests. No provider is repackaged, nothing is written to your file. |
| `name`, `baseUrl`, `apiKey`, `api`, `oauth`, `authHeader` | Matched providers get a composed config, as if those keys were in `providers`. |
| `models`, `modelOverrides` | Not supported: definitions and overrides are not defaults. |

An explicit value always wins, including `false`. Object fields merge key by key, everything else is replaced.

## `inherit` field

```jsonc
{ "id": "glm-5.3", "inherit": "zai/glm-5.3" }
```

- `inherit` is the model to copy: `"provider/modelId"`.
- The model `id` must be provided.
- A field you write in the entry (say `"maxTokens": 1000`) overrides the inherited value.

## Test

```bash
npm test
```
