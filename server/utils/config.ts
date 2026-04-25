import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import crypto from "node:crypto"
import JSON5 from "json5"

const HOME_DIR = path.join(os.homedir(), ".openclaw")
const CONFIG_FILE = path.join(HOME_DIR, "openclaw.json")

export function getConfigPath(): string {
  return CONFIG_FILE
}

function getWorkspaceAgentId(name: string): string | null {
  if (name === "workspace") return "main"
  if (name.startsWith("workspace-")) return name.slice("workspace-".length)
  return null
}

export function listWorkspaceAgents(): Array<{
  id: string
  label: string
  workspace: string
  agentDir?: string
}> {
  if (!fs.existsSync(HOME_DIR)) {
    return []
  }

  const entries = fs.readdirSync(HOME_DIR, { withFileTypes: true })
  const agents = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const id = getWorkspaceAgentId(entry.name)
      if (!id) return null

      const workspace = path.join(HOME_DIR, entry.name)
      const agentDir = path.join(HOME_DIR, "agents", id, "agent")

      return {
        id,
        label: id,
        workspace,
        ...(fs.existsSync(agentDir) ? { agentDir } : {}),
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  return agents.sort((a, b) => a.id.localeCompare(b.id))
}

export function readConfig(): Record<string, unknown> {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {}
  }
  const raw = fs.readFileSync(CONFIG_FILE, "utf-8")
  return JSON5.parse(raw)
}

/**
 * Compute a simple hash of the config file for optimistic locking.
 * Returns null if file doesn't exist.
 */
export function getConfigHash(): string | null {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null
  }
  const raw = fs.readFileSync(CONFIG_FILE, "utf-8")
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32)
}

/**
 * Read raw config text (for baseHash verification and ${VAR} preservation)
 */
export function readConfigRaw(): string | null {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null
  }
  return fs.readFileSync(CONFIG_FILE, "utf-8")
}

/**
 * Atomic config file write following OpenClaw's pattern:
 * 1. Write to temp file
 * 2. Create backup of existing config
 * 3. Atomic rename (tmp → target)
 * 4. Set permissions to 0o600
 * 5. Clean up old backups (keep latest 5)
 */
export function writeConfig(
  config: Record<string, unknown>,
  options?: { baseHash?: string | null }
): void {
  const dir = path.dirname(CONFIG_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Verify baseHash (optimistic locking)
  if (options?.baseHash) {
    const currentHash = getConfigHash()
    if (currentHash && currentHash !== options.baseHash) {
      throw new Error(`Optimistic lock failed: config was modified (baseHash mismatch). Please reload and try again.`)
    }
  }

  // Generate temp file path
  const tmpFile = `${CONFIG_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`

  try {
    // 1. Write to temp file first
    const content = JSON.stringify(config, null, 2) + "\n"
    fs.writeFileSync(tmpFile, content)

    // 2. Create backup of existing config before replacing
    if (fs.existsSync(CONFIG_FILE)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const backupPath = `${CONFIG_FILE}.${timestamp}.bak`
      fs.copyFileSync(CONFIG_FILE, backupPath)

      // 3. Clean up old backups, keep latest 5
      const backups = fs
        .readdirSync(HOME_DIR)
        .filter((f: string) => f.startsWith("openclaw.json.") && f.endsWith(".bak"))
        .sort()
      while (backups.length > 5) {
        fs.unlinkSync(path.join(HOME_DIR, backups.shift()!))
      }
    }

    // 4. Atomic rename (tmp → target)
    fs.renameSync(tmpFile, CONFIG_FILE)

    // 5. Set restrictive permissions (0o600 = owner read/write only)
    fs.chmodSync(CONFIG_FILE, 0o600)
  } catch (err) {
    // Clean up temp file on error
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile) } catch {}
    }
    throw err
  }
}

/**
 * Patch config: merge partial updates with existing config (like OpenClaw's config.patch)
 * Preserves ${VAR} references that might be hidden in forms.
 */
export function patchConfig(
  patch: Record<string, unknown>,
  options?: { baseHash?: string | null }
): void {
  const existing = readConfig()
  const merged = deepMerge(existing, patch)
  writeConfig(merged, options)
}

/**
 * Simple deep merge utility.
 * Arrays are replaced (not merged).
 * Objects are merged recursively.
 * Primitives (including null) replace.
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target }
  for (const key of Object.keys(source)) {
    const sourceVal = source[key]
    const targetVal = target[key]
    if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>)
    } else {
      result[key] = sourceVal
    }
  }
  return result
}
