# OpenClaw 模型/供应商配置逻辑分析

## 核心结论

**供应商认证（Provider Auth）先于 Agent 配置，且供应商配置是全局的，多个 Agent 共享同一供应商配置和认证。**

---

## 1. 配置架构概览

### 1.1 三层结构

```
Global Provider Registry（全局注册表）
        │
        ▼
models.providers（全局配置，所有 Agent 共享）
        │
        ├── Agent A → 引用 "provider/model"
        ├── Agent B → 引用 "provider/model"
        └── Agent C → 引用 "provider/model"
```

### 1.2 关键文件

| 文件 | 职责 |
|------|------|
| [types.models.ts](src/config/types.models.ts) | `ModelProviderConfig`、`ModelsConfig` 类型定义 |
| [types.agents.ts](src/config/types.agents.ts) | `AgentConfig`、`AgentModelConfig` 类型定义 |
| [types.openclaw.ts](src/config/types.openclaw.ts) | `OpenClawConfig` 顶层类型，包含 `models` 和 `agents` |
| [types.ts (plugins)](src/plugins/types.ts) | `ProviderPlugin` 类型，`registerProvider()` 方法 |
| [auth-profiles/types.ts](src/agents/auth-profiles/types.ts) | `AuthProfileStore` 类型，认证存储结构 |
| [commands/models/auth.ts](src/commands/models/auth.ts) | `openclaw models auth` 命令实现 |

---

## 2. 供应商（Provider）层 — 全局配置

### 2.1 供应商注册

供应商由 **插件（Plugin）** 在加载时注册，而非按 Agent 注册：

```typescript
// src/plugins/types.ts:1939
registerProvider: (provider: ProviderPlugin) => void;
```

每个供应商插件注册时提供：
- `id`：供应商标识（如 `"openai"`、`"anthropic"`）
- `auth`：支持的认证方式数组
- `catalog`：模型目录（返回 `ModelProviderConfig`）
- 各类 Provider 自有钩子

### 2.2 供应商配置位置

供应商配置位于 `models.providers`，是**全局**的，不按 Agent 划分：

```typescript
// src/config/types.models.ts:100-102
type ModelsConfig = {
  mode?: "merge" | "replace";
  providers?: Record<string, ModelProviderConfig>;  // key 是 provider id
};
```

`ModelProviderConfig` 结构（[types.models.ts:75-85](src/config/types.models.ts#L75-L85)）：

```typescript
type ModelProviderConfig = {
  baseUrl: string;
  apiKey?: SecretInput;
  auth?: ModelProviderAuthMode;   // "api-key" | "aws-sdk" | "oauth" | "token"
  api?: ModelApi;                  // "openai-completions" | "anthropic-messages" 等
  models: ModelDefinitionConfig[]; // 该供应商下的模型定义
};
```

**示例配置结构：**

```json5
{
  "models": {
    "mode": "merge",
    "providers": {
      "openai": {
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "${OPENAI_API_KEY}",
        "api": "openai-completions",
        "models": [{ "id": "gpt-4", "reasoning": true, ... }]
      },
      "anthropic": {
        "baseUrl": "https://api.anthropic.com",
        "apiKey": "${ANTHROPIC_API_KEY}",
        "api": "anthropic-messages",
        "models": [{ "id": "claude-sonnet-4-6", ... }]
      }
    }
  }
}
```

---

## 3. Agent 层 — 引用供应商/模型

### 3.1 Agent 模型配置

Agent 通过 **字符串引用** 格式 `"provider/model"` 来指定使用的模型（[types.agent-defaults.ts:17-28](src/config/types.agent-defaults.ts#L17-L28)）：

```typescript
type AgentModelEntryConfig = {
  alias?: string;
  params?: Record<string, unknown>;
  streaming?: boolean;
};

type AgentModelListConfig = {
  primary?: string;           // 例如 "anthropic/claude-sonnet-4-6"
  fallbacks?: string[];        // 例如 ["openai/gpt-4"]
};

type AgentModelConfig = string | AgentModelListConfig;
```

### 3.2 Agent 配置结构

```typescript
// src/config/types.agents.ts:70-122
type AgentConfig = {
  id: string;
  model?: AgentModelConfig;    // 引用 "provider/model"
  thinkingDefault?: "off" | "minimal" | "low" | "medium" | "high";
  // ... 其他 per-agent 配置
};
```

**示例 Agent 配置：**

```json5
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-6",
        "fallbacks": ["openai/gpt-4"]
      }
    },
    "list": [
      {
        "id": "main",
        "model": "anthropic/claude-sonnet-4-6"
      },
      {
        "id": "coder",
        "model": {
          "primary": "openai/gpt-4",
          "fallbacks": ["anthropic/claude-sonnet-4-6"]
        }
      }
    ]
  }
}
```

---

## 4. 认证（Auth）层 — 按 Agent 存储

### 4.1 Auth Profile 存储位置

认证凭据**按 Agent 存储**，每个 Agent 有独立的 `auth-profiles.json`：

```
~/.openclaw/agents/<agentId>/auth-profiles.json
```

类型定义（[auth-profiles/types.ts:99-102](src/agents/auth-profiles/types.ts#L99-L102)）：

```typescript
type AuthProfileSecretsStore = {
  version: number;
  profiles: Record<string, AuthProfileCredential>;  // key: "provider:name"
};

type AuthProfileStore = AuthProfileSecretsStore & AuthProfileState;
```

### 4.2 Auth Profile Key 格式

```typescript
// 格式: "<provider>:<name>"
"openai:default"
"openai:manual"
"anthropic:default"
```

### 4.3 认证流程（先有供应商，再认证）

`openclaw models auth login --provider openai` 的流（[commands/models/auth.ts:108-132](src/commands/models/auth.ts#L108-L132)）：

```typescript
async function resolveModelsAuthContext(params?) {
  const config = await loadValidConfigOrThrow();           // 1. 加载全局配置
  const defaultAgentId = resolveDefaultAgentId(config);     // 2. 确定目标 Agent
  const agentDir = resolveAgentDir(config, defaultAgentId); // 3. 解析 Agent 目录
  const providers = resolvePluginProviders({                // 4. 解析已注册的供应商
    config, workspaceDir, mode: "setup",
    ...(params?.requestedProvider ? { providerRefs: [params.requestedProvider], activate: true } : {}),
  });
  return { config, agentDir, workspaceDir, providers };
}
```

**关键点：** 认证流程不要求先创建 Agent，而是：
1. 供应商通过插件注册（系统级）
2. 用户针对**已注册的供应商**进行认证
3. 认证凭据存储到**指定 Agent** 的 `auth-profiles.json`

---

## 5. 完整关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                     Plugin System (系统级)                        │
│                                                                 │
│  Plugin.registerProvider(provider)                               │
│    ├── openai provider (id: "openai")                           │
│    ├── anthropic provider (id: "anthropic")                     │
│    └── ...                                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              models.providers（全局配置，openclaw.json5）          │
│                                                                 │
│  "openai": { baseUrl, apiKey, models: [...] }                  │
│  "anthropic": { baseUrl, apiKey, models: [...] }               │
│  "ollama": { baseUrl, models: [...] }                          │
│                                                                 │
│  ← 所有 Agent 共享同一份供应商配置                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Agent: main    │ │   Agent: coder   │ │  Agent: helper   │
│                  │ │                  │ │                  │
│  model:         │ │  model:         │ │  model:         │
│  "anthropic/    │ │  "openai/gpt-4"│ │  "ollama/       │
│   claude-sonnet" │ │                  │ │   llama3"       │
│                  │ │                  │ │                  │
│  auth-profiles: │ │  auth-profiles: │ │  auth-profiles: │
│  openai:default │ │  openai:default │ │  ollama:default │
│  anthropic:def  │ │  anthropic:def  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│        ~/.openclaw/agents/<agentId>/auth-profiles.json           │
│                                                                 │
│  {                                                               │
│    "version": 1,                                                  │
│    "profiles": {                                                   │
│      "openai:default": { "type": "api_key", "provider": "openai" },│
│      "anthropic:default": { "type": "api_key", "provider": "anthropic" }│
│    }                                                               │
│  }                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 配置顺序总结

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 插件注册供应商 | 系统启动时，插件调用 `registerProvider()` 注册供应商 |
| 2 | 配置 `models.providers` | 在 `openclaw.json5` 中配置全局供应商（baseUrl、apiKey 等） |
| 3 | 执行 `openclaw models auth login` | 为用户（Agent）配置供应商认证凭据 |
| 4 | 配置 Agent 的 model | 在 `agents.list[].model` 或 `agents.defaults.model` 中引用 `"provider/model"` |
| 5 | 运行时解析 | Agent 引用 → 查找 `models.providers` → 匹配 `auth-profiles.json` → 发起 API 调用 |

---

## 7. 关键设计要点

1. **供应商是全局的**：`models.providers` 不按 Agent 划分，所有 Agent 共享同一供应商配置
2. **认证按 Agent 隔离**：`auth-profiles.json` 每个 Agent 独立一份，不同 Agent 可用不同凭据访问同一供应商
3. **Agent 通过字符串引用模型**：`"provider/model"` 格式建立 Agent → 供应商/模型的关联
4. **先有供应商，后有认证**：认证流程针对已注册的供应商，不依赖 Agent 是否存在
5. **乐观锁保护配置**：`baseHash` 机制防止并发修改覆盖
