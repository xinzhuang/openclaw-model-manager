import { Pencil, Trash2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"
import { getBuiltinProvider } from "@/lib/constants"
import type { ProviderConfig } from "@/types"

interface ProviderCardProps {
  providerId: string
  provider: ProviderConfig
  onEdit: () => void
  onDelete: () => void
  source?: "global" | "agent"
}

export function ProviderCard({ providerId, provider, onEdit, onDelete, source }: ProviderCardProps) {
  const { t } = useTranslation()
  const builtin = getBuiltinProvider(providerId)
  const displayName = builtin?.name || providerId
  const isBuiltin = !!builtin
  const models = provider.models ?? []

  return (
    <Card className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-accent/50">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{displayName}</span>
          {isBuiltin && (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Built-in
            </Badge>
          )}
          {source === "agent" && (
            <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
              Agent
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {provider.baseUrl || (isBuiltin ? builtin.baseUrl : t("providers.noModels"))}
        </p>
        {models.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {models.map((m) => (
              <Badge key={m.id} variant="outline" className="text-[11px]">
                {m.name || m.id}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label={t("common.edit")}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label={t("common.delete")}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  )
}
