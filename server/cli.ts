#!/usr/bin/env tsx
import { spawn, execSync } from "node:child_process"
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = process.env.PROJECT_ROOT
  ? resolve(process.env.PROJECT_ROOT)
  : resolve(__dirname, "..")
const PID_FILE = resolve(PROJECT_ROOT, ".omm.pid")
const PORT = process.env.PORT || 3457

const color = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

function resolveBin(name: string, require: ReturnType<typeof createRequire>): string {
  try {
    const pkgJson = require.resolve(`${name}/package.json`, { paths: [PROJECT_ROOT] })
    if (name === "tsx") return join(pkgJson, "..", "dist", "cli.mjs")
    try { return require.resolve(`${name}/cli.js`, { paths: [PROJECT_ROOT] }) } catch {}
    return join(PROJECT_ROOT, "node_modules", ".bin", name)
  } catch {
    return join(PROJECT_ROOT, "node_modules", ".bin", name)
  }
}

function readPid(): number | null {
  if (!existsSync(PID_FILE)) return null
  const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10)
  return Number.isFinite(pid) ? pid : null
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function httpProbe(): Promise<boolean> {
  return fetch(`http://localhost:${PORT}/api/config/path`, { signal: AbortSignal.timeout(2000) })
    .then((r) => r.ok)
    .catch(() => false)
}

function openBrowser(url: string): void {
  const platforms = { darwin: "open", win32: "start", linux: "xdg-open" } as const
  const platform = process.platform as keyof typeof platforms
  const cmd = platforms[platform] ?? "xdg-open"
  try {
    execSync(`${cmd} ${JSON.stringify(url)}`, { stdio: "ignore" })
  } catch {
    // Silently fail — user can still open the URL manually
  }
}

function showHelp() {
  console.log(`
${color.bold("omm")} — OpenClaw Model Manager CLI

${color.bold("Usage:")}
  omm <command>

${color.bold("Commands:")}
  start     Start the OpenClaw Model Manager server
  stop      Stop the OpenClaw Model Manager server
  status    Show OpenClaw Model Manager server status
  install   Install 'omm' command globally via npm link
  help      Show this help message

${color.bold("Install:")}
  ${color.green("omm install")} in the project directory to register
  the ${color.bold("omm")} command globally.
`)
}

async function cmdInstall() {
  try {
    execSync("npm link", { cwd: PROJECT_ROOT, stdio: "inherit" })
    console.log(color.green("\nDone! 'omm' is now available globally."))
  } catch {
    console.error(color.red("Failed to run 'npm link'. Make sure npm is installed and you have write permission."))
    process.exit(1)
  }
}

const VITE_PORT = 7123
const FRONTEND_URL = `http://localhost:${VITE_PORT}`
const PROD_URL = `http://localhost:${PORT}`

function hasDist(): boolean {
  return existsSync(resolve(PROJECT_ROOT, "dist", "index.html"))
}

async function cmdStart() {
  const existing = readPid()
  if (existing && isAlive(existing)) {
    console.log(color.yellow(`OpenClaw Model Manager is already running (PID ${existing})`))
    return
  }

  const useDev = process.env.NODE_ENV !== "production" && !hasDist()

  if (useDev) {
    // Dev mode: start backend + frontend via concurrently
    const require = createRequire(join(PROJECT_ROOT, "package.json"))
    const concurrently = resolveBin("concurrently", require)
    const tsxBin = resolveBin("tsx", require)
    const viteBin = resolveBin("vite", require)

    const child = spawn(concurrently, [
      "--names", "api,ui",
      "--prefix-colors", "cyan,magenta",
      `${tsxBin} watch server/index.ts`,
      `${viteBin}`,
    ], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "development" },
    })

    child.stdout?.on("data", (chunk: Buffer) => process.stdout.write(chunk))
    child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk))
    writeFileSync(PID_FILE, String(child.pid))

    let ready = false
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500))
      if (child.pid && !isAlive(child.pid)) break
      try {
        const res = await fetch(FRONTEND_URL, { signal: AbortSignal.timeout(1000) })
        if (res.ok) { ready = true; break }
      } catch {}
    }

    if (!ready || child.pid == null || !isAlive(child.pid)) {
      unlinkSync(PID_FILE)
      console.error(color.red("OpenClaw Model Manager failed to start"))
      process.exit(1)
    }

    child.unref()
    console.log(color.green(`OpenClaw Model Manager started (PID ${child.pid})`))
    console.log(color.dim(`  ${FRONTEND_URL}`))
    openBrowser(FRONTEND_URL)
    return
  }

  // Production mode: backend serves built frontend (or dev fallback)
  const cmd = process.execPath
  const tsxBin = resolveBin("tsx", createRequire(join(PROJECT_ROOT, "package.json")))
  const args = [tsxBin, resolve(PROJECT_ROOT, "server", "index.ts")]
  const child = spawn(cmd, args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
  })

  child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk))
  writeFileSync(PID_FILE, String(child.pid))

  await new Promise((r) => setTimeout(r, 500))
  if (child.pid == null || !isAlive(child.pid)) {
    unlinkSync(PID_FILE)
    console.error(color.red("OpenClaw Model Manager failed to start (process exited)"))
    process.exit(1)
  }

  child.unref()
  console.log(color.green(`OpenClaw Model Manager started (PID ${child.pid})`))
  console.log(color.dim(`  ${PROD_URL}`))
  openBrowser(PROD_URL)
}

async function cmdStop() {
  const pid = readPid()
  if (!pid) {
    console.log(color.yellow("OpenClaw Model Manager is not running (no PID file)"))
    return
  }

  if (!isAlive(pid)) {
    console.log(color.yellow(`Stale PID file found (PID ${pid} not alive), cleaning up`))
    unlinkSync(PID_FILE)
    return
  }

  process.kill(pid, "SIGTERM")

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100))
    if (!isAlive(pid)) break
  }

  if (isAlive(pid)) {
    process.kill(pid, "SIGKILL")
    await new Promise((r) => setTimeout(r, 200))
  }

  try { unlinkSync(PID_FILE) } catch {}
  console.log(color.green(`OpenClaw Model Manager stopped (PID ${pid})`))
}

async function cmdStatus() {
  const pid = readPid()
  if (!pid) {
    console.log(color.red("OpenClaw Model Manager: not running"))
    return
  }

  if (!isAlive(pid)) {
    console.log(color.red(`OpenClaw Model Manager: not running (stale PID ${pid})`))
    console.log(color.dim("  Run 'ocr stop' to clean up"))
    return
  }

  const healthy = await httpProbe()
  if (healthy) {
    console.log(color.green(`OpenClaw Model Manager: running (PID ${pid})`))
    console.log(color.dim(`  http://localhost:${PORT}`))
  } else {
    console.log(color.yellow(`OpenClaw Model Manager: process alive (PID ${pid}) but not responding`))
  }
}

const commands: Record<string, () => void | Promise<void>> = {
  start: cmdStart, stop: cmdStop, status: cmdStatus, install: cmdInstall, help: showHelp,
}
const sub = process.argv[2]

if (!sub || !(sub in commands)) {
  showHelp()
  process.exit(sub ? 1 : 0)
}

Promise.resolve(commands[sub]()).catch((err: unknown) => {
  console.error(color.red(`Error: ${(err as Error).message}`))
  process.exit(1)
})
