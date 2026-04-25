import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Save, Check, Moon, Sun, Languages, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useConfig } from "@/context/ConfigProvider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function Header() {
  const { t, i18n } = useTranslation()
  const { save, saving, refresh } = useConfig()
  const [saved, setSaved] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))

  const handleSave = async () => {
    const ok = await save()
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
  }

  const toggleLang = () => {
    const next = i18n.language === "zh" ? "en" : "zh"
    i18n.changeLanguage(next)
  }

  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex h-14 items-center justify-between border-b border-border/50 px-5 backdrop-blur-sm bg-background/80">
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-md bg-primary/90 flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground font-mono">MC</span>
          </div>
          <h1 className="text-base font-semibold tracking-tight font-mono">
            {t("app.title")}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-8 w-8 rounded-lg hover:bg-primary/10 transition-colors duration-200"
              >
                {dark ? (
                  <Sun className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                ) : (
                  <Moon className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-xs">
              {t("header.theme")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleLang}
                className="h-8 w-8 rounded-lg hover:bg-primary/10 transition-colors duration-200"
              >
                <Languages className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-xs">
              {t("header.language")}
            </TooltipContent>
          </Tooltip>

          <div className="mx-1 h-5 w-px bg-border/50" />

          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className={`
              h-8 gap-1.5 text-xs font-mono transition-all duration-300
              ${saved ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : ""}
              ${saving ? "opacity-70" : ""}
            `}
          >
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                {t("header.saved")}
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                {t("header.save")}
              </>
            )}
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-8 w-8 rounded-lg hover:bg-primary/10 transition-colors duration-200"
              >
                <RefreshCw className={`h-4 w-4 text-muted-foreground hover:text-foreground transition-colors ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-xs">
              Refresh config
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  )
}
