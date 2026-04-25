import { useState, useMemo, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Plus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Combobox } from "@/components/ui/combobox"
import { BUILTIN_PROVIDERS, getBuiltinProvider, API_TYPES } from "@/lib/constants"
import { showToast } from "@/components/ui/toast"
import type { ProviderConfig, ModelDefinition, ApiType } from "@/types"

interface ProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerId: string | null
  providers: Record<string, ProviderConfig>
  onSave: (id: string, config: ProviderConfig) => void
  source?: "global" | "agent"
}

type ProviderType = "builtin" | "custom"

interface ModelFormData {
  id: string
  name: string
  reason_ing: boolean
  vision: boolean
  contextWindow: string
  maxTokens: string
}

const emptyModelForm = (): ModelFormData => ({
  id: "",
  name: "",
  reason_ing: false,
  vision: false,
  contextWindow: "",
  maxTokens: "",
})

export function ProviderDialog({ open, onOpenChange, providerId, providers, onSave, source = "global" }: ProviderDialogProps) {
  const { t } = useTranslation()
  const isEditing = providerId !== null
  const existing = isEditing ? providers[providerId] : null
  const existingBuiltin = isEditing ? getBuiltinProvider(providerId) : undefined

  const [providerType, setProviderType] = useState<ProviderType>("custom")
  const [builtinId, setBuiltinId] = useState("")
  const [name, setName] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [apiType, setApiType] = useState<ApiType>("openai-completions")
  const [models, setModels] = useState<ModelDefinition[]>([])

  // Initialize all form fields when dialog opens / providerId changes
  useEffect(() => {
    if (!isEditing || !existing) {
      // Reset for "add" mode
      setProviderType("custom")
      setBuiltinId("")
      setName("")
      setBaseUrl("")
      setApiKey("")
      setApiType("openai-completions")
      setModels([])
      return
    }

    // Populate form from existing provider config
    const isBuiltin = !!existingBuiltin
    setProviderType(isBuiltin ? "builtin" : "custom")
    setBuiltinId(isBuiltin ? providerId : "")
    setName(providerId)
    setBaseUrl(existing.baseUrl ?? "")
    // apiKey from config may be a SecretRef object; show placeholder instead
    const key = existing.apiKey
    setApiKey(typeof key === "string" ? key : "")
    setApiType(existing.api ?? "openai-completions")
    setModels(existing.models ?? [])
  }, [isEditing, providerId, existing, existingBuiltin])

  const [modelDialogOpen, setModelDialogOpen] = useState(false)
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null)
  const [modelForm, setModelForm] = useState<ModelFormData>(emptyModelForm())

  const builtinOptions = useMemo(
    () => [
      { value: "builtin", label: t("providers.builtin"), group: t("providers.type") },
      { value: "custom", label: t("providers.custom"), group: t("providers.type") },
    ],
    [t]
  )

  const builtinProviderOptions = useMemo(
    () =>
      BUILTIN_PROVIDERS.filter((bp) => bp.id !== providerId).map((bp) => ({
        value: bp.id,
        label: bp.name,
      })),
    [providerId]
  )

  const apiTypeOptions = useMemo(() => API_TYPES, [])

  const resetForm = useCallback(() => {
    setProviderType("custom")
    setBuiltinId("")
    setName("")
    setBaseUrl("")
    setApiKey("")
    setApiType("openai-completions")
    setModels([])
    setModelDialogOpen(false)
    setEditingModelIndex(null)
    setModelForm(emptyModelForm())
  }, [])

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  const selectedBuiltin = builtinId ? getBuiltinProvider(builtinId) : undefined

  const handleSave = () => {
    const id = providerType === "builtin" ? builtinId : name.trim()
    if (!id) {
      showToast(t("common.required"), "error")
      return
    }
    if (providerType === "custom") {
      const normalized = id.toLowerCase().replace(/\s+/g, "-")
      const usedIds = Object.keys(providers).filter((k) => k !== providerId)
      if (usedIds.includes(normalized)) {
        showToast(t("common.error"), "error")
        return
      }
    }

    // Start with existing config to preserve all fields (auth, headers, etc.)
    const config: ProviderConfig = { ...(existing || {}) }
    if (providerType === "custom") {
      if (baseUrl.trim()) config.baseUrl = baseUrl.trim()
      else delete config.baseUrl
      if (apiKey.trim()) config.apiKey = apiKey.trim()
      else delete config.apiKey
      config.api = apiType
    } else {
      if (apiKey.trim()) config.apiKey = apiKey.trim()
      else delete config.apiKey
      delete config.api  // builtin providers don't need api field
    }
    config.models = models  // always set models (preserves empty array if user deleted all)

    onSave(id, config)
    handleClose(false)
  }

  const openModelDialog = (index?: number) => {
    if (index !== undefined && index >= 0 && index < models.length) {
      const m = models[index]
      setModelForm({
        id: m.id,
        name: m.name ?? "",
        reason_ing: m.reason_ing ?? false,
        vision: m.input?.includes("image") ?? false,
        contextWindow: m.contextWindow != null ? String(m.contextWindow) : "",
        maxTokens: m.maxTokens != null ? String(m.maxTokens) : "",
      })
      setEditingModelIndex(index)
    } else {
      setModelForm(emptyModelForm())
      setEditingModelIndex(null)
    }
    setModelDialogOpen(true)
  }

  const saveModel = () => {
    const modelId = modelForm.id.trim()
    if (!modelId) {
      showToast(t("common.required"), "error")
      return
    }

    const dup = models.some((m, i) => m.id === modelId && i !== editingModelIndex)
    if (dup) {
      showToast(t("common.error"), "error")
      return
    }

    const def: ModelDefinition = { id: modelId }
    if (modelForm.name.trim()) def.name = modelForm.name.trim()
    if (modelForm.reason_ing) def.reason_ing = true
    if (modelForm.vision) def.input = ["text", "image"]
    if (modelForm.contextWindow) def.contextWindow = Number(modelForm.contextWindow) || undefined
    if (modelForm.maxTokens) def.maxTokens = Number(modelForm.maxTokens) || undefined

    if (editingModelIndex !== null) {
      const next = [...models]
      next[editingModelIndex] = def
      setModels(next)
    } else {
      setModels([...models, def])
    }
    setModelDialogOpen(false)
  }

  const removeModel = (index: number) => {
    setModels(models.filter((_, i) => i !== index))
  }

  const dialogTitle = isEditing ? t("providers.edit") : t("providers.add")

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogTitle}
              <span className="text-xs font-normal text-muted-foreground">
                {source === "global" ? `(${t("providers.globalSection")})` : `(${t("agents.title")})`}
              </span>
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? t("providers.edit")
                : t("providers.add")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("providers.type")}</Label>
              <Combobox
                options={builtinOptions}
                value={providerType}
                onValueChange={(v) => setProviderType(v as ProviderType)}
                placeholder={t("common.selectPlaceholder")}
              />
            </div>

            {providerType === "builtin" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>{t("providers.name")}</Label>
                  <Combobox
                    options={builtinProviderOptions}
                    value={builtinId}
                    onValueChange={setBuiltinId}
                    placeholder={t("common.selectPlaceholder")}
                    disabled={isEditing}
                  />
                </div>
                {selectedBuiltin && (
                  <div className="space-y-2">
                    <Label>{t("providers.apiKey")}</Label>
                    <Input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={selectedBuiltin.envVar ? `$\{${selectedBuiltin.envVar}\}` : t("providers.apiKeyPlaceholder")}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>{t("providers.name")}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("providers.namePlaceholder")}
                    disabled={isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("providers.baseUrl")}</Label>
                  <Input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("providers.apiKey")}</Label>
                  <Input
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t("providers.apiKeyPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("providers.apiType")}</Label>
                  <Combobox
                    options={apiTypeOptions}
                    value={apiType}
                    onValueChange={(v) => setApiType(v as ApiType)}
                    placeholder={t("common.selectPlaceholder")}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("providers.models")}</Label>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => openModelDialog()}>
                  <Plus className="h-3 w-3" />
                  {t("providers.addModel")}
                </Button>
              </div>
              {models.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("providers.noModels")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {models.map((m, i) => (
                    <Badge key={m.id} variant="secondary" className="gap-1 pr-1 text-[11px]">
                      <button type="button" className="hover:underline" onClick={() => openModelDialog(i)}>
                        {m.name || m.id}
                      </button>
                      <button
                        type="button"
                        className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                        onClick={() => removeModel(i)}
                        aria-label={t("common.delete")}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingModelIndex !== null ? t("models.edit") : t("models.add")}
            </DialogTitle>
            <DialogDescription>
              {editingModelIndex !== null ? t("models.edit") : t("models.add")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t("models.id")}</Label>
              <Input
                value={modelForm.id}
                onChange={(e) => setModelForm((f) => ({ ...f, id: e.target.value }))}
                placeholder={t("models.idPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("models.name")}</Label>
              <Input
                value={modelForm.name}
                onChange={(e) => setModelForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("models.reasoning")}</Label>
              <Switch
                checked={modelForm.reason_ing}
                onCheckedChange={(checked) => setModelForm((f) => ({ ...f, reason_ing: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("models.vision")}</Label>
              <Switch
                checked={modelForm.vision}
                onCheckedChange={(checked) => setModelForm((f) => ({ ...f, vision: checked }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("models.contextWindow")}</Label>
              <Input
                type="number"
                value={modelForm.contextWindow}
                onChange={(e) => setModelForm((f) => ({ ...f, contextWindow: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("models.maxTokens")}</Label>
              <Input
                type="number"
                value={modelForm.maxTokens}
                onChange={(e) => setModelForm((f) => ({ ...f, maxTokens: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModelDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={saveModel}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
