# pi-model-inherit

[English](./README.md) | **简体中文**

给 `models.json` 加两个功能：

1. `default` 块：所有 provider 都继承的值。
2. `inherit` 字段：一个模型继承另一个模型的配置。

不用它就不生效；写错了只警告一次，不影响使用。

```jsonc
{
  // 1. default 块：所有 provider 都继承的值
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
        // 2. inherit 字段：复制另一个模型的配置
        { "id": "glm-5.3", "inherit": "zai/glm-5.3" },
        // 也可以再覆盖个别字段
        { "id": "glm-5.3-fast", "inherit": "zai/glm-5.3", "maxTokens": 1000 }
      ]
    }
  }
}
```

## `default` 块

所有 provider 都继承的值。`"*"` 覆盖全部 provider，写具体的 provider id 则只作用于它。

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

| 键 | 生效方式 |
|---|---|
| `compat`、`headers` | 在模型层和请求层注入。不重组任何 provider，也不写回你的文件。 |
| `name`、`baseUrl`、`apiKey`、`api`、`oauth`、`authHeader` | 命中的 provider 得到一份合成配置，等同于把这些键直接写在 `providers` 里。 |
| `models`、`modelOverrides` | 不支持：定义和覆盖不是默认值。 |

显式写的值永远优先，包括 `false`。对象型字段逐键合并，其余整体替换。

## `inherit` 字段

```jsonc
{ "id": "glm-5.3", "inherit": "zai/glm-5.3" }
```

- `inherit` 写要继承的 `"provider/modelId"`。
- 模型 `id` 必须提供。
- 想改的字段直接写在这条里（比如 `"maxTokens": 1000`），会盖掉继承来的值。

## 测试

```bash
npm test
```
