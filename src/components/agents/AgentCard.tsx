import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "react-i18next"
import { resolveModelRef } from "@/lib/constants"
import type { AgentConfig } from "@/types"

interface AgentCardProps {
  agent: AgentConfig
  modelOptions: Array<{ value: string; label: string }>
  onEdit: () => void
  onDelete: () => void
}

export function AgentCard({ agent, modelOptions, onEdit, onDelete }: AgentCardProps) {
  const { t } = useTranslation()
  const resolvedModel = resolveModelRef(agent.model)
  const modelOption = modelOptions.find((o) => o.value === resolvedModel)

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{agent.name || agent.id}</span>
            {agent.name && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {agent.id}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {modelOption && (
              <span className="truncate">{t("agents.model")}: {modelOption.label}</span>
            )}
            {agent.workspace && (
              <span className="truncate">{t("agents.workspace")}: {agent.workspace}</span>
            )}
          </div>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t("common.edit")}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label={t("common.delete")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
