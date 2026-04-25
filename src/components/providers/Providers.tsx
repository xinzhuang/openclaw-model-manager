import { useState, useMemo, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Plus, Search, Globe, Bot } from "lucide-react"
import { useConfig } from "@/context/ConfigProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProviderCard } from "./ProviderCard"
import { ProviderDialog } from "./ProviderDialog"
import { showToast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import type { ProviderConfig } from "@/types"

type ProviderSource = "global" | "agent"

interface ProviderEntry {
  id: string
  provider: ProviderConfig
  source: ProviderSource
}

export function Providers({ agentId }: { agentId?: string }) {
  const { t } = useTranslation()
  const { config, baseHash, refresh } = useConfig()
  const globalProviders = config.models?.providers ?? {}

  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingSource, setEditingSource] = useState<ProviderSource>("global")
  const [agentProviders, setAgentProviders] = useState<Record<string, ProviderConfig>>({})

  // Load per-agent models.json providers
  useEffect(() => {
    if (!agentId) {
      setAgentProviders({})
      return
    }
    let active = true
    api
      .getAgentModels(agentId)
      .then((rawProviders) => {
        if (!active) return
        const converted: Record<string, ProviderConfig> = {}
        for (const [pid, p] of Object.entries(rawProviders)) {
          converted[pid] = {
            baseUrl: p.baseUrl,
            api: p.api as any,
            models: (p.models || []).map((m) => ({
              id: m.id,
              name: m.name,
            })),
          }
        }
        setAgentProviders(converted)
      })
      .catch(() => {
        if (!active) return
        setAgentProviders({})
      })
    return () => { active = false }
  }, [agentId])

  // Build separate entries for each source
  const globalEntries = useMemo<ProviderEntry[]>(
    () => Object.entries(globalProviders).map(([id, provider]) => ({ id, provider, source: "global" as const })),
    [globalProviders]
  )

  const agentEntries = useMemo<ProviderEntry[]>(
    () => Object.entries(agentProviders).map(([id, provider]) => ({ id, provider, source: "agent" as const })),
    [agentProviders]
  )

  // Search filter applied across all entries
  const filterEntries = useCallback(
    (entries: ProviderEntry[]) => {
      if (!search.trim()) return entries
      const q = search.toLowerCase()
      return entries.filter(({ id, provider }) => {
        const modelMatch = (provider.models ?? []).some(
          (m) => m.id.toLowerCase().includes(q) || (m.name ?? "").toLowerCase().includes(q)
        )
        return id.toLowerCase().includes(q) || (provider.baseUrl ?? "").toLowerCase().includes(q) || modelMatch
      })
    },
    [search]
  )

  const filteredGlobal = useMemo(() => filterEntries(globalEntries), [globalEntries, filterEntries])
  const filteredAgent = useMemo(() => filterEntries(agentEntries), [agentEntries, filterEntries])

  const globalCount = globalEntries.length
  const agentCount = agentEntries.length
  const totalCount = globalCount + agentCount

  const handleOpenAdd = (source: ProviderSource) => {
    setEditingId(null)
    setEditingSource(source)
    setDialogOpen(true)
  }

  const handleOpenEdit = useCallback((id: string, source: ProviderSource) => {
    setEditingId(id)
    setEditingSource(source)
    setDialogOpen(true)
  }, [])

  const handleDeleteGlobal = useCallback(async (id: string) => {
    try {
      const next = { ...config }
      if (next.models?.providers) {
        const { [id]: _, ...rest } = next.models.providers
        next.models = { ...next.models, providers: rest }
      }
      await api.updateConfig(next, baseHash)
      await refresh()
      showToast(t("toast.providerDeleted"), "success")
    } catch (err) {
      showToast(t("common.error"), "error")
      refresh()
    }
  }, [config, baseHash, refresh, t])

  const handleDeleteAgent = useCallback(async (id: string) => {
    if (!agentId) return
    try {
      await api.deleteAgentProvider(agentId, id)
      // Reload agent providers
      const rawProviders = await api.getAgentModels(agentId)
      const converted: Record<string, ProviderConfig> = {}
      for (const [pid, p] of Object.entries(rawProviders)) {
        converted[pid] = { baseUrl: p.baseUrl, api: p.api as any, models: (p.models || []).map((m) => ({ id: m.id, name: m.name })) }
      }
      setAgentProviders(converted)
      showToast(t("toast.providerDeleted"), "success")
    } catch (err) {
      showToast(t("common.error"), "error")
    }
  }, [agentId, t])

  const handleSaveGlobal = useCallback(async (id: string, providerConfig: ProviderConfig) => {
    try {
      const next = { ...config }
      const existing = next.models?.providers?.[id]
      const merged = existing ? { ...existing, ...providerConfig } : providerConfig
      next.models = {
        ...next.models,
        providers: { ...(next.models?.providers ?? {}), [id]: merged },
      }
      await api.updateConfig(next, baseHash)
      await refresh()
      showToast(editingId ? t("toast.providerUpdated") : t("toast.providerAdded"), "success")
    } catch (err) {
      showToast(t("common.error"), "error")
      refresh()
    }
  }, [config, baseHash, refresh, editingId, t])

  const handleSaveAgent = useCallback(async (id: string, providerConfig: ProviderConfig) => {
    if (!agentId) return
    try {
      await api.updateAgentProvider(agentId, id, providerConfig)
      // Reload agent providers
      const rawProviders = await api.getAgentModels(agentId)
      const converted: Record<string, ProviderConfig> = {}
      for (const [pid, p] of Object.entries(rawProviders)) {
        converted[pid] = { baseUrl: p.baseUrl, api: p.api as any, models: (p.models || []).map((m) => ({ id: m.id, name: m.name })) }
      }
      setAgentProviders(converted)
      showToast(editingId ? t("toast.providerUpdated") : t("toast.providerAdded"), "success")
    } catch (err) {
      showToast(t("common.error"), "error")
    }
  }, [agentId, editingId, t])

  const handleSave = useCallback(
    (id: string, providerConfig: ProviderConfig) => {
      if (editingSource === "global") {
        handleSaveGlobal(id, providerConfig)
      } else {
        handleSaveAgent(id, providerConfig)
      }
    },
    [editingSource, handleSaveGlobal, handleSaveAgent]
  )

  // Providers available for the dialog context (for duplicate ID checking)
  const dialogProviders = useMemo(
    () => editingSource === "global" ? globalProviders : agentProviders,
    [editingSource, globalProviders, agentProviders]
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">
          {t("providers.title")} ({totalCount})
        </h2>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => handleOpenAdd("agent")} disabled={!agentId}>
            <Bot className="h-3.5 w-3.5" />
            {t("providers.addAgentProvider")}
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleOpenAdd("global")}>
            <Plus className="h-3.5 w-3.5" />
            {t("providers.add")}
          </Button>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="border-b px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("providers.search")}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {totalCount === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("providers.noProviders")}
            </p>
          )}

          {/* Global providers section */}
          {globalCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {t("providers.globalSection")}
                </span>
                <span className="text-[10px] text-muted-foreground/70">— {t("providers.globalSectionDesc")}</span>
              </div>
              {filteredGlobal.length === 0 && (
                <p className="px-1 text-xs text-muted-foreground">{t("common.noResults")}</p>
              )}
              {filteredGlobal.map(({ id, provider }) => (
                <ProviderCard
                  key={`global-${id}`}
                  providerId={id}
                  provider={provider}
                  onEdit={() => handleOpenEdit(id, "global")}
                  onDelete={() => handleDeleteGlobal(id)}
                  source="global"
                />
              ))}
            </div>
          )}

          {/* Per-agent providers section */}
          {agentCount > 0 && agentId && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {t("providers.agentSection", { name: agentId })}
                </span>
                <span className="text-[10px] text-muted-foreground/70">— {t("providers.agentSectionDesc")}</span>
              </div>
              {filteredAgent.length === 0 && (
                <p className="px-1 text-xs text-muted-foreground">{t("common.noResults")}</p>
              )}
              {filteredAgent.map(({ id, provider }) => (
                <ProviderCard
                  key={`agent-${id}`}
                  providerId={id}
                  provider={provider}
                  onEdit={() => handleOpenEdit(id, "agent")}
                  onDelete={() => handleDeleteAgent(id)}
                  source="agent"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        providerId={editingId}
        providers={dialogProviders}
        onSave={handleSave}
        source={editingSource}
      />
    </div>
  )
}
