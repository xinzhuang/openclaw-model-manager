import type { AuthProfile, DiscoveredAgent, OpenClawConfig, ProviderConfig } from "@/types"

const API_BASE = "/api"

interface ConfigResponse {
  config: OpenClawConfig
  baseHash: string | null
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error(error.message || `Request failed: ${res.status}`)
    }
    return res.json()
  }

  getConfig(): Promise<ConfigResponse> {
    return this.request<ConfigResponse>("/config")
  }

  getConfigRaw(): Promise<string> {
    return new Promise((resolve, reject) => {
      fetch(`${this.baseUrl}/config`, { headers: { Accept: "text/plain" } })
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to load config: ${res.status}`)
          return res.text()
        })
        .then(resolve)
        .catch(reject)
    })
  }

  updateConfig(config: OpenClawConfig, baseHash?: string | null): Promise<{ success: boolean; baseHash: string | null }> {
    return this.request("/config", {
      method: "POST",
      body: JSON.stringify({ config, baseHash }),
    })
  }

  patchConfig(patch: Partial<OpenClawConfig>, baseHash?: string | null): Promise<{ success: boolean; baseHash: string | null }> {
    return this.request("/config", {
      method: "PATCH",
      body: JSON.stringify({ patch, baseHash }),
    })
  }

  getConfigPath(): Promise<{ path: string }> {
    return this.request("/config/path")
  }

  getDiscoveredAgents(): Promise<DiscoveredAgent[]> {
    return this.request("/config/agents/discovered")
  }

  getAuthProfiles(agentId: string): Promise<Record<string, AuthProfile>> {
    return this.request(`/config/agents/${agentId}/auth-profiles`).then((r: any) => r.profiles || {})
  }

  getAgentModels(agentId: string): Promise<Record<string, { baseUrl?: string; api?: string; models: Array<{ id: string; name?: string }> }>> {
    return this.request(`/config/agents/${agentId}/models`).then((r: any) => r.providers || {})
  }

  updateAgentProvider(agentId: string, providerId: string, config: ProviderConfig): Promise<{ success: boolean }> {
    return this.request(`/config/agents/${agentId}/models/${providerId}`, {
      method: "PUT",
      body: JSON.stringify(config),
    })
  }

  deleteAgentProvider(agentId: string, providerId: string): Promise<{ success: boolean }> {
    return this.request(`/config/agents/${agentId}/models/${providerId}`, {
      method: "DELETE",
    })
  }
}

export const api = new ApiClient()
export type { ConfigResponse }
