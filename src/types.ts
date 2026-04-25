export interface OpenClawConfig {
  models?: {
    mode?: "merge" | "replace"
    providers?: Record<string, ProviderConfig>
  }
  agents?: {
    defaults?: AgentDefaults
    list?: AgentConfig[]
  }
  env?: Record<string, string | Record<string, string>> & {
    vars?: { [key: string]: string }
  }
  [key: string]: unknown
}

export type ApiType =
  | "openai-completions"
  | "openai-responses"
  | "openai-codex-responses"
  | "anthropic-messages"
  | "google-generative-ai"
  | "github-copilot"
  | "bedrock-converse-stream"
  | "ollama"
  | "azure-openai-responses"

export type AuthMode = "api-key" | "aws-sdk" | "oauth" | "token"

export interface SecretRef {
  source: "env" | "file" | "exec"
  provider: string
  id: string
}

export interface ProviderConfig {
  baseUrl?: string
  apiKey?: string | SecretRef
  auth?: AuthMode
  api?: ApiType
  injectNumCtxForOpenAICompat?: boolean
  headers?: Record<string, string | SecretRef>
  authHeader?: boolean
  request?: {
    headers?: Record<string, string | SecretRef>
  }
  models?: ModelDefinition[]
}

export interface ModelDefinition {
  id: string
  name?: string
  api?: ApiType
  reason_ing?: boolean
  input?: ("text" | "image")[]
  contextWindow?: number
  contextTokens?: number
  maxTokens?: number
  cost?: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
  }
  headers?: Record<string, string | SecretRef>
  compat?: {
    supportsStore?: boolean
    supportsDeveloperRole?: boolean
    supportsReasoningEffort?: boolean
    supportsUsageInStreaming?: boolean
    supportsTools?: boolean
    supportsStrictMode?: boolean
    requiresStringContent?: boolean
    maxTokensField?: "max_completion_tokens" | "max_tokens"
    thinkingFormat?: "openai" | "openrouter" | "zai" | "qwen" | "qwen-chat-template"
    requiresToolResultName?: boolean
    requiresAssistantAfterToolResult?: boolean
    requiresThinkingAsText?: boolean
    toolSchemaProfile?: string
    unsupportedToolSchemaKeywords?: string[]
    nativeWebSearchTool?: boolean
    toolCallArgumentsEncoding?: string
    requiresMistralToolIds?: boolean
    requiresOpenAiAnthropicToolPayload?: boolean
    [key: string]: unknown
  }
}

export interface AgentDefaults {
  model?: string | ModelRef
  imageModel?: string | ModelRef
  pdfModel?: string | ModelRef
  imageGenerationModel?: string | ModelRef
  videoGenerationModel?: string | ModelRef
  musicGenerationModel?: string | ModelRef
  models?: Record<string, ModelAliasConfig>
  params?: Record<string, unknown>
  thinkingDefault?: string
  timeoutSeconds?: number
  contextTokens?: number
  maxConcurrent?: number
}

export interface ModelRef {
  primary: string
  fallbacks?: string[]
}

export interface ModelAliasConfig {
  alias?: string
  params?: Record<string, unknown>
}

export interface AgentConfig {
  id: string
  name?: string
  workspace?: string
  agentDir?: string
  model?: string | ModelRef
  imageModel?: string | ModelRef
  thinkingDefault?: string
  params?: Record<string, unknown>
  imageGenerationModel?: string | ModelRef
  pdfModel?: string | ModelRef
  videoGenerationModel?: string | ModelRef
  musicGenerationModel?: string | ModelRef
  models?: Record<string, ModelAliasConfig>
  maxConcurrent?: number
  timeoutSeconds?: number
  contextTokens?: number
}

export interface DiscoveredAgent {
  id: string
  label: string
  workspace: string
  agentDir?: string
}

export interface BuiltinProvider {
  id: string
  name: string
  envVar: string
  baseUrl: string
}

export interface FlatModelRef {
  providerId: string
  modelId: string
  label: string
}

export interface AuthProfile {
  type: "api_key" | "oauth"
  provider: string
  key?: string
  access?: string
  refresh?: string
  expires?: number
  accountId?: string
  managedBy?: string
}

export interface AuthProfilesFile {
  version: number
  profiles: Record<string, AuthProfile>
}

export interface AuthStateFile {
  version: number
  lastGood: Record<string, string>
  usageStats: Record<string, {
    lastUsed?: number
    errorCount: number
    lastFailureAt?: number
    disabledUntil?: number
    disabledReason?: string
    failureCounts?: Record<string, number>
  }>
}

export interface AgentModelFile {
  providers: Record<string, ProviderConfig>
}
