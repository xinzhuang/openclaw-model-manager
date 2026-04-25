import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import { useConfig } from "@/context/ConfigProvider"
import { resolveModelRef } from "@/lib/constants"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Combobox } from "@/components/ui/combobox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AgentConfig, AgentDefaults, DiscoveredAgent, ModelRef, OpenClawConfig } from "@/types"
import { AuthProfiles } from "./AuthProfiles"

const THINKING_OPTIONS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

function getAllModelOptions(
  config: OpenClawConfig,
  agentProviders?: Record<string, { baseUrl?: string; api?: string; models: Array<{ id: string; name?: string }> }>
): Array<{ value: string; label: string }> {
  const seen = new Set<string>()
  const options: Array<{ value: string; label: string }> = []

  const addProvider = (providerId: string, models: Array<{ id: string; name?: string }>) => {
    for (const model of models) {
      const ref = `${providerId}/${model.id}`
      if (seen.has(ref)) continue
      seen.add(ref)
      options.push({ value: ref, label: model.name ? `${model.name} (${ref})` : ref })
    }
  }

  // Per-agent providers first (more relevant)
  if (agentProviders) {
    for (const [providerId, provider] of Object.entries(agentProviders)) {
      addProvider(providerId, provider.models || [])
    }
  }

  // Global providers as fallback
  const global = config.models?.providers || {}
  for (const [providerId, provider] of Object.entries(global)) {
    addProvider(providerId, provider.models || [])
  }

  return options
}

function getFallbacks(modelRef?: string | ModelRef): string[] {
  if (!modelRef || typeof modelRef === "string" || !modelRef.fallbacks) {
    return []
  }
  return modelRef.fallbacks
}

function toModelRef(primary: string | undefined, fallbacks: string[]): string | ModelRef | undefined {
  if (!primary) return undefined
  return fallbacks.length > 0 ? { primary, fallbacks } : primary
}

function cleanupAgent(agent: AgentConfig): AgentConfig {
  const next = { ...agent }
  if (!next.name?.trim()) delete next.name
  if (!next.workspace?.trim()) delete next.workspace
  if (!next.agentDir?.trim()) delete next.agentDir
  if (!next.model) delete next.model
  if (!next.imageModel) delete next.imageModel
  if (!next.thinkingDefault || next.thinkingDefault === "none") delete next.thinkingDefault
  return next
}

function upsertAgent(list: AgentConfig[], nextAgent: AgentConfig): AgentConfig[] {
  const index = list.findIndex((agent) => agent.id === nextAgent.id)
  if (index === -1) return [...list, nextAgent]
  const next = [...list]
  next[index] = nextAgent
  return next
}

interface AgentsProps {
  onAgentSelect?: (agentId: string | null) => void
}

export function Agents({ onAgentSelect }: AgentsProps) {
  const { t } = useTranslation()
  const { config, setConfig } = useConfig()
  const [discoveredAgents, setDiscoveredAgents] = useState<DiscoveredAgent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [agentProviders, setAgentProviders] = useState<Record<string, { baseUrl?: string; api?: string; models: Array<{ id: string; name?: string }> }>>({})

  // Agent list: prioritize config.agents.list, supplement with filesystem-discovered agents
  const configuredAgents = config.agents?.list || []
  const agentDefaults = config.agents?.defaults || {}

  // Build agent options from config.agents.list
  const agentListOptions = useMemo(
    () => configuredAgents.map((a) => ({
      value: a.id,
      label: a.name || a.id,
    })),
    [configuredAgents]
  )

  // Discover filesystem agents (workspace directories) to merge with config list
  useEffect(() => {
    let active = true
    api
      .getDiscoveredAgents()
      .then((agents) => {
        if (!active) return
        setDiscoveredAgents(agents)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // Load per-agent models.json when agent selection changes
  useEffect(() => {
    if (!selectedAgentId) {
      setAgentProviders({})
      return
    }
    let active = true
    api
      .getAgentModels(selectedAgentId)
      .then((providers) => {
        if (!active) return
        setAgentProviders(providers)
      })
      .catch(() => {
        if (!active) return
        setAgentProviders({})
      })
    return () => { active = false }
  }, [selectedAgentId])

  // Merge: config.agents.list has priority, filesystem agents fill in gaps
  const allAgentOptions = useMemo(() => {
    const configIds = new Set(configuredAgents.map((a) => a.id))
    const merged = [...agentListOptions]
    for (const da of discoveredAgents) {
      if (!configIds.has(da.id)) {
        merged.push({ value: da.id, label: da.id })
      }
    }
    return merged
  }, [agentListOptions, discoveredAgents, configuredAgents])

  // Auto-select first agent if none selected, notify parent
  useEffect(() => {
    if (allAgentOptions.length === 0) {
      setSelectedAgentId("")
      onAgentSelect?.(null)
      return
    }
    const next = !selectedAgentId || !allAgentOptions.some((o) => o.value === selectedAgentId)
      ? allAgentOptions[0].value
      : selectedAgentId
    if (next !== selectedAgentId) {
      setSelectedAgentId(next)
    }
    onAgentSelect?.(next)
  }, [allAgentOptions])

  // Lookup helpers
  const selectedConfig = useMemo(
    () => configuredAgents.find((a) => a.id === selectedAgentId),
    [configuredAgents, selectedAgentId]
  )

  const selectedDiscovered = useMemo(
    () => discoveredAgents.find((a) => a.id === selectedAgentId),
    [discoveredAgents, selectedAgentId]
  )

  // Effective agent config: inherit from defaults, override with per-agent config
  const effectiveAgent = useMemo((): AgentConfig => {
    const base: AgentConfig = { id: selectedAgentId }

    // Inherit defaults
    if (agentDefaults.model) base.model = agentDefaults.model
    if (agentDefaults.thinkingDefault) base.thinkingDefault = agentDefaults.thinkingDefault
    if (agentDefaults.params) base.params = agentDefaults.params

    // Override with per-agent config (from agents.list)
    if (selectedConfig) {
      if (selectedConfig.model) base.model = selectedConfig.model
      if (selectedConfig.thinkingDefault) base.thinkingDefault = selectedConfig.thinkingDefault
      if (selectedConfig.params) base.params = selectedConfig.params
      if (selectedConfig.name) base.name = selectedConfig.name
      if (selectedConfig.workspace) base.workspace = selectedConfig.workspace
      if (selectedConfig.agentDir) base.agentDir = selectedConfig.agentDir
    }

    // Add filesystem info
    if (selectedDiscovered) {
      if (!base.workspace) base.workspace = selectedDiscovered.workspace
      if (!base.agentDir && selectedDiscovered.agentDir) base.agentDir = selectedDiscovered.agentDir
    }

    return base
  }, [selectedAgentId, agentDefaults, selectedConfig, selectedDiscovered])

  // Model options: per-agent models.json + global models.providers
  const modelOptions = useMemo(
    () => getAllModelOptions(config, agentProviders),
    [config, agentProviders]
  )

  const primaryModel = resolveModelRef(effectiveAgent.model)
  const imageModel = resolveModelRef(agentDefaults.imageModel)
  const primaryFallbacks = useMemo(() => getFallbacks(effectiveAgent.model), [effectiveAgent.model])
  const imageFallbacks = useMemo(() => getFallbacks(agentDefaults.imageModel), [agentDefaults.imageModel])
  const thinkingDefault = effectiveAgent.thinkingDefault || "none"

  const updateSelectedAgent = useCallback(
    (updater: (agent: AgentConfig) => AgentConfig) => {
      if (!selectedAgentId) return

      const currentList = config.agents?.list || []
      const existingAgent = currentList.find((agent) => agent.id === selectedAgentId)
      const baseAgent: AgentConfig = {
        ...effectiveAgent,
        ...existingAgent,
        id: selectedAgentId,
        ...(selectedDiscovered
          ? {
              workspace: selectedDiscovered.workspace,
              ...(selectedDiscovered.agentDir ? { agentDir: selectedDiscovered.agentDir } : {}),
            }
          : {}),
      }

      const nextAgent = cleanupAgent(updater(baseAgent))

      setConfig({
        ...config,
        agents: {
          ...config.agents,
          list: upsertAgent(currentList, nextAgent),
        },
      })
    },
    [config, selectedAgentId, selectedDiscovered, effectiveAgent, setConfig]
  )

  const setPrimaryModel = useCallback(
    (value: string) => {
      updateSelectedAgent((agent) => ({
        ...agent,
        model: toModelRef(value, getFallbacks(agent.model)),
      }))
    },
    [updateSelectedAgent]
  )

  // Update agents.defaults (for fields not supported in per-agent list, like imageModel)
  const updateDefaults = useCallback(
    (updater: (defaults: AgentDefaults) => AgentDefaults) => {
      const currentDefaults = config.agents?.defaults || {}
      const nextDefaults = updater(currentDefaults)
      setConfig({
        ...config,
        agents: {
          ...config.agents,
          defaults: nextDefaults,
        },
      })
    },
    [config, setConfig]
  )

  const setImageModel = useCallback(
    (value: string) => {
      const currentImageModel = config.agents?.defaults?.imageModel
      updateDefaults((defaults) => ({
        ...defaults,
        imageModel: toModelRef(value, getFallbacks(currentImageModel)),
      }))
    },
    [config, updateDefaults]
  )

  const setPrimaryFallbacks = useCallback(
    (fallbacks: string[]) => {
      updateSelectedAgent((agent) => ({
        ...agent,
        model: toModelRef(resolveModelRef(agent.model), fallbacks),
      }))
    },
    [updateSelectedAgent]
  )

  const setImageFallbacks = useCallback(
    (fallbacks: string[]) => {
      const currentImageModel = config.agents?.defaults?.imageModel
      updateDefaults((defaults) => ({
        ...defaults,
        imageModel: toModelRef(resolveModelRef(currentImageModel), fallbacks),
      }))
    },
    [config, updateDefaults]
  )

  const handleAddFallback = useCallback(
    (type: "primary" | "image", value: string) => {
      if (!value) return
      const current = type === "primary" ? primaryFallbacks : imageFallbacks
      if (current.includes(value)) return
      const next = [...current, value]
      if (type === "primary") { setPrimaryFallbacks(next); return }
      setImageFallbacks(next)
    },
    [imageFallbacks, primaryFallbacks, setImageFallbacks, setPrimaryFallbacks]
  )

  const handleRemoveFallback = useCallback(
    (type: "primary" | "image", index: number) => {
      const current = type === "primary" ? primaryFallbacks : imageFallbacks
      const next = current.filter((_, i) => i !== index)
      if (type === "primary") { setPrimaryFallbacks(next); return }
      setImageFallbacks(next)
    },
    [imageFallbacks, primaryFallbacks, setImageFallbacks, setPrimaryFallbacks]
  )

  const getAvailableFallbackOptions = useCallback(
    (current: string[]) => modelOptions.filter((option) => !current.includes(option.value)),
    [modelOptions]
  )

  const isInConfig = configuredAgents.some((a) => a.id === selectedAgentId)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("agents.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label>{t("agents.selectAgent")}</Label>
            <Combobox
              options={allAgentOptions}
              value={selectedAgentId}
              onValueChange={(value) => {
                setSelectedAgentId(value)
                onAgentSelect?.(value)
              }}
              placeholder={t("common.selectPlaceholder")}
              emptyMessage={t("agents.noDiscoveredAgents")}
              disabled={allAgentOptions.length === 0}
            />
            {isInConfig ? (
              <p className="text-xs text-muted-foreground">{t("agents.configSource")}</p>
            ) : selectedAgentId ? (
              <p className="text-xs text-muted-foreground">{t("agents.filesystemSource")}</p>
            ) : null}
          </div>

          {allAgentOptions.length === 0 && (
            <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
              {t("agents.noDiscoveredAgents")}
            </p>
          )}

          {selectedAgentId && (
            <>
              {selectedDiscovered && (
                <div className="grid gap-2">
                  <Label>{t("agents.workspaceSource")}</Label>
                  <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs break-all font-mono">
                    {selectedDiscovered.workspace}
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label>{t("agents.primary")}</Label>
                <Combobox
                  options={modelOptions}
                  value={primaryModel}
                  onValueChange={setPrimaryModel}
                  placeholder={t("common.selectPlaceholder")}
                  emptyMessage={t("common.noResults")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("agents.fallbacks")}</Label>
                {primaryFallbacks.map((fallback, index) => (
                  <div key={fallback} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono">
                      {fallback}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFallback("primary", index)}
                      aria-label="Remove fallback"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Combobox
                  options={getAvailableFallbackOptions(primaryFallbacks)}
                  onValueChange={(value) => handleAddFallback("primary", value)}
                  placeholder={t("agents.addFallback")}
                  emptyMessage={t("common.noResults")}
                  disabled={!primaryModel}
                />
              </div>

              <div className="grid gap-2">
                <Label>{t("agents.imageModel")}</Label>
                <Combobox
                  options={modelOptions}
                  value={imageModel}
                  onValueChange={setImageModel}
                  placeholder={t("common.selectPlaceholder")}
                  emptyMessage={t("common.noResults")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("agents.fallbacks")}</Label>
                {imageFallbacks.map((fallback, index) => (
                  <div key={fallback} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono">
                      {fallback}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFallback("image", index)}
                      aria-label="Remove fallback"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Combobox
                  options={getAvailableFallbackOptions(imageFallbacks)}
                  onValueChange={(value) => handleAddFallback("image", value)}
                  placeholder={t("agents.addFallback")}
                  emptyMessage={t("common.noResults")}
                  disabled={!imageModel}
                />
              </div>

              <div className="grid gap-2">
                <Label>{t("agents.thinkingDefault")}</Label>
                <Select
                  value={thinkingDefault}
                  onValueChange={(value) => updateSelectedAgent((agent) => ({ ...agent, thinkingDefault: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THINKING_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedAgentId && (
        <AuthProfiles agentId={selectedAgentId} />
      )}
    </div>
  )
}
