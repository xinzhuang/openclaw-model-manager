import type { BuiltinProvider } from "@/types"

export const BUILTIN_PROVIDERS: BuiltinProvider[] = [
  { id: "openai", name: "OpenAI", envVar: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", name: "Anthropic", envVar: "ANTHROPIC_API_KEY", baseUrl: "https://api.anthropic.com" },
  { id: "google", name: "Google Gemini", envVar: "GEMINI_API_KEY", baseUrl: "https://generativelanguage.googleapis.com" },
  { id: "google-vertex", name: "Google Vertex AI", envVar: "", baseUrl: "" },
  { id: "openai-codex", name: "OpenAI Codex (OAuth)", envVar: "", baseUrl: "https://chatgpt.com/backend-api" },
  { id: "codex", name: "Codex CLI", envVar: "", baseUrl: "https://chatgpt.com/backend-api/v1" },
  { id: "opencode", name: "OpenCode (Zen)", envVar: "OPENCODE_API_KEY", baseUrl: "" },
  { id: "opencode-go", name: "OpenCode (Go)", envVar: "OPENCODE_API_KEY", baseUrl: "" },
  { id: "xai", name: "xAI (Grok)", envVar: "XAI_API_KEY", baseUrl: "https://api.x.ai" },
  { id: "openrouter", name: "OpenRouter", envVar: "OPENROUTER_API_KEY", baseUrl: "https://openrouter.ai/api/v1" },
  { id: "deepseek", name: "DeepSeek", envVar: "DEEPSEEK_API_KEY", baseUrl: "https://api.deepseek.com/v1" },
  { id: "mistral", name: "Mistral", envVar: "MISTRAL_API_KEY", baseUrl: "https://api.mistral.ai/v1" },
  { id: "moonshot", name: "Moonshot (Kimi)", envVar: "MOONSHOT_API_KEY", baseUrl: "https://api.moonshot.ai/v1" },
  { id: "minimax", name: "MiniMax", envVar: "MINIMAX_API_KEY", baseUrl: "https://api.minimax.chat" },
  { id: "zai", name: "Z.AI (GLM)", envVar: "ZAI_API_KEY", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  { id: "ollama", name: "Ollama (Local)", envVar: "", baseUrl: "http://127.0.0.1:11434/v1" },
  { id: "qwen-portal", name: "Qwen Portal (OAuth)", envVar: "", baseUrl: "https://portal.qwen.ai/v1" },
  { id: "kimi-coding", name: "Kimi for Coding", envVar: "KIMI_API_KEY", baseUrl: "https://api.kimi.com/coding/v1" },
  { id: "kimi", name: "Kimi", envVar: "KIMI_API_KEY", baseUrl: "https://api.kimi.com/coding/" },
  { id: "qwen", name: "Qwen (DashScope)", envVar: "DASHSCOPE_API_KEY", baseUrl: "https://coding-intl.dashscope.aliyuncs.com/v1" },
  { id: "github-copilot", name: "GitHub Copilot", envVar: "GITHUB_TOKEN", baseUrl: "https://api.github.com/copilot" },
  { id: "bedrock", name: "AWS Bedrock", envVar: "AWS_ACCESS_KEY_ID", baseUrl: "" },
  { id: "azure-openai", name: "Azure OpenAI", envVar: "AZURE_OPENAI_API_KEY", baseUrl: "" },
]

export const API_TYPES: Array<{ value: string; label: string }> = [
  { value: "openai-completions", label: "OpenAI Completions" },
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "openai-codex-responses", label: "OpenAI Codex Responses" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
  { value: "google-generative-ai", label: "Google Generative AI" },
  { value: "github-copilot", label: "GitHub Copilot" },
  { value: "bedrock-converse-stream", label: "AWS Bedrock Converse" },
  { value: "ollama", label: "Ollama" },
  { value: "azure-openai-responses", label: "Azure OpenAI Responses" },
]

export function getBuiltinProvider(id: string): BuiltinProvider | undefined {
  return BUILTIN_PROVIDERS.find((p) => p.id === id)
}

export function resolveModelRef(modelRef?: string | { primary: string; fallbacks?: string[] }): string | undefined {
  if (!modelRef) return undefined
  if (typeof modelRef === "string") return modelRef
  return modelRef.primary
}

export function parseModelRef(modelRef: string): { providerId: string; modelId: string } | null {
  const idx = modelRef.indexOf("/")
  if (idx === -1) return null
  return { providerId: modelRef.slice(0, idx), modelId: modelRef.slice(idx + 1) }
}

export function formatModelRef(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`
}
