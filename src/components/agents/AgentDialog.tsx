import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useConfig } from "@/context/ConfigProvider"
import { resolveModelRef } from "@/lib/constants"
import { showToast } from "@/components/ui/toast"
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
import { Combobox } from "@/components/ui/combobox"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import type { AgentConfig, OpenClawConfig } from "@/types"

interface AgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent?: AgentConfig | null
  mode: "add" | "edit"
}

const THINKING_OPTIONS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

function getAllModelOptions(config: OpenClawConfig): Array<{ value: string; label: string }> {
  const providers = config.models?.providers || {}
  const options: Array<{ value: string; label: string }> = []
  for (const [providerId, provider] of Object.entries(providers)) {
    for (const model of provider.models || []) {
      options.push({ value: `${providerId}/${model.id}`, label: `${providerId}/${model.id}` })
    }
  }
  return options
}

export function AgentDialog({ open, onOpenChange, agent, mode }: AgentDialogProps) {
  const { t } = useTranslation()
  const { config, setConfig } = useConfig()

  const existingIds = useMemo(
    () => (config.agents?.list || []).map((a) => a.id),
    [config.agents?.list]
  )

  const [id, setId] = useState(agent?.id || "")
  const [name, setName] = useState(agent?.name || "")
  const [workspace, setWorkspace] = useState(agent?.workspace || "")
  const [model, setModel] = useState(resolveModelRef(agent?.model) || "")
  const [thinkingDefault, setThinkingDefault] = useState(agent?.thinkingDefault || "none")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const modelOptions = useMemo(() => getAllModelOptions(config), [config])

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!id.trim()) {
      next.id = t("common.required")
    } else if (mode === "add" && existingIds.includes(id.trim())) {
      next.id = `Agent "${id.trim()}" already exists`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = () => {
    if (!validate()) return

    const currentList = config.agents?.list || []
    const existingAgent = mode === "edit"
      ? currentList.find((a) => a.id === agent?.id)
      : undefined
    const agentConfig: AgentConfig = {
      ...existingAgent,
      id: id.trim(),
    }

    if (name.trim()) agentConfig.name = name.trim()
    else delete agentConfig.name

    if (workspace.trim()) agentConfig.workspace = workspace.trim()
    else delete agentConfig.workspace

    if (model) agentConfig.model = model
    else delete agentConfig.model

    if (thinkingDefault !== "none") agentConfig.thinkingDefault = thinkingDefault
    else delete agentConfig.thinkingDefault

    if (mode === "add") {
      setConfig({
        ...config,
        agents: {
          ...config.agents,
          list: [...currentList, agentConfig],
        },
      })
      showToast(t("toast.agentAdded"), "success")
    } else {
      setConfig({
        ...config,
        agents: {
          ...config.agents,
          list: currentList.map((a) => (a.id === agent?.id ? agentConfig : a)),
        },
      })
    }

    onOpenChange(false)
  }

  const resetAndClose = () => {
    setErrors({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "add" ? t("agents.add") : t("agents.edit")}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? t("agents.add")
              : t("agents.edit")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="agent-id">{t("agents.agentId")} *</Label>
            <Input
              id="agent-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="my-agent"
              disabled={mode === "edit"}
              aria-invalid={!!errors.id}
            />
            {errors.id && <p className="text-sm text-destructive">{errors.id}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="agent-name">{t("agents.agentName")}</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Agent"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="agent-workspace">{t("agents.workspace")}</Label>
            <Input
              id="agent-workspace"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder="/path/to/workspace"
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("agents.model")}</Label>
            <Combobox
              options={modelOptions}
              value={model}
              onValueChange={setModel}
              placeholder={t("common.selectPlaceholder")}
              emptyMessage={t("common.noResults")}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("agents.thinkingDefault")}</Label>
            <Select value={thinkingDefault} onValueChange={setThinkingDefault}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THINKING_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
