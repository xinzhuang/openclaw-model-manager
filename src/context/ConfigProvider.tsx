import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { OpenClawConfig } from "@/types"
import { api } from "@/lib/api"
import type { ConfigResponse } from "@/lib/api"

interface ConfigContextValue {
  config: OpenClawConfig
  setConfig: (config: OpenClawConfig) => void
  loading: boolean
  error: string | null
  save: () => Promise<boolean>
  saving: boolean
  refresh: () => Promise<void>
  baseHash: string | null
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error("useConfig must be used within ConfigProvider")
  return ctx
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<OpenClawConfig>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [baseHash, setBaseHash] = useState<string | null>(null)

  const loadConfig = useCallback(() => {
    return api
      .getConfig()
      .then((data: ConfigResponse) => {
        setConfigState(data.config || {})
        setBaseHash(data.baseHash || null)
        setError(null)
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadConfig()
  }, [])

  const setConfig = useCallback((c: OpenClawConfig) => setConfigState(c), [])

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true)
    try {
      await api.updateConfig(config, baseHash)
      await loadConfig()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    } finally {
      setSaving(false)
    }
  }, [config, baseHash])

  const refresh = useCallback(async () => {
    setLoading(true)
    await loadConfig()
  }, [loadConfig])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (error && !Object.keys(config).length) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-destructive">Failed to load config: {error}</div>
      </div>
    )
  }

  return (
    <ConfigContext.Provider value={{ config, setConfig, loading, error, save, saving, refresh, baseHash }}>
      {children}
    </ConfigContext.Provider>
  )
}
