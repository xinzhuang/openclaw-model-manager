import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Key, RefreshCw, Clock, AlertTriangle } from "lucide-react"
import { api } from "@/lib/api"
import type { AuthProfile } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface AuthProfilesProps {
  agentId: string
}

export function AuthProfiles({ agentId }: AuthProfilesProps) {
  const { t } = useTranslation()
  const [profiles, setProfiles] = useState<Record<string, AuthProfile>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfiles = useCallback(() => {
    setLoading(true)
    api
      .getAuthProfiles(agentId)
      .then((data) => {
        setProfiles(data || {})
        setError(null)
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [agentId])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "-"
    return new Date(timestamp).toLocaleString()
  }

  const isExpired = (profile: AuthProfile) => {
    if (!profile.expires) return false
    return Date.now() > profile.expires
  }

  const profileEntries = Object.entries(profiles)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            {t("agents.authProfiles")}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={loadProfiles} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && profileEntries.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("agents.noAuthProfiles")}</p>
        )}
        {!loading && !error && profileEntries.length > 0 && (
          <div className="space-y-3">
            {profileEntries.map(([key, profile]) => {
              const expired = isExpired(profile)
              return (
                <div key={key} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{key}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={profile.type === "oauth" ? "default" : "secondary"}>
                        {profile.type}
                      </Badge>
                      {expired && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t("agents.expired")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>{t("agents.provider")}: {profile.provider}</p>
                    {profile.accountId && <p>accountId: {profile.accountId}</p>}
                    {profile.managedBy && <p>managedBy: {profile.managedBy}</p>}
                    {profile.expires && (
                      <p className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {expired ? t("agents.expiredAt") : t("agents.expiresAt")}: {formatDate(profile.expires)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
