import { select } from "@inquirer/prompts"
import { readConfig, patchConfig, getConfigHash } from "../utils/config.js"
import type { OpenClawConfig, ProviderConfig } from "../../src/types.js"

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  boldCyan: (s: string) => `\x1b[1m\x1b[36m${s}\x1b[0m`,
}

interface FlatModel {
  providerId: string
  modelId: string
  name?: string
}

function resolveModel(model?: string | { primary: string }): string | undefined {
  if (!model) return undefined
  return typeof model === "string" ? model : model.primary
}

function flattenModels(providers: Record<string, ProviderConfig>): FlatModel[] {
  const result: FlatModel[] = []
  for (const [providerId, provider] of Object.entries(providers)) {
    for (const model of provider.models ?? []) {
      result.push({ providerId, modelId: model.id, name: model.name })
    }
  }
  return result
}

function displayName(m: FlatModel): string {
  return m.name ? `${m.name} ${c.dim(`(${m.modelId})`)}` : m.modelId
}

export async function cmdModel(): Promise<void> {
  const config = readConfig() as OpenClawConfig
  const providers = config.models?.providers

  if (!providers || Object.keys(providers).length === 0) {
    console.error(c.red("No providers configured. Add providers first via the web UI or edit ~/.openclaw/openclaw.json"))
    process.exit(1)
  }

  const models = flattenModels(providers)
  if (models.length === 0) {
    console.error(c.red("No models found in any provider. Add models first."))
    process.exit(1)
  }

  const currentModel = resolveModel(config.agents?.defaults?.model)
  console.log()
  if (currentModel) {
    console.log(`${c.bold("Current model:")} ${c.yellow(currentModel)}`)
  } else {
    console.log(`${c.bold("Current model:")} ${c.dim("not set")}`)
  }
  console.log()

  const choices = models.map((m) => {
    const ref = `${m.providerId}/${m.modelId}`
    const isCurrent = ref === currentModel
    return {
      name: `${c.boldCyan(m.providerId)} / ${c.cyan(displayName(m))}${isCurrent ? c.green(" (current)") : ""}`,
      value: ref,
    }
  })

  const selected = await select({
    message: "Select default model:",
    choices,
    pageSize: 20,
    loop: false,
  })

  if (selected === currentModel) {
    console.log(c.dim("\nNo change."))
    return
  }

  const hash = getConfigHash()
  const patch: Record<string, unknown> = {
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        model: selected,
      },
    },
  }
  patchConfig(patch, { baseHash: hash })

  console.log(`\n${c.green("✓")} Default model set to ${c.yellow(selected)}\n`)
}
