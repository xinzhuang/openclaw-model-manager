#!/usr/bin/env node
import { spawn } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")

const require = createRequire(import.meta.url)

function resolveBin(name) {
  try {
    const pkgJson = require.resolve(`${name}/package.json`, { paths: [projectRoot] })
    if (name === "tsx") return join(pkgJson, "..", "dist", "cli.mjs")
    try { return require.resolve(`${name}/cli.js`, { paths: [projectRoot] }) } catch {}
    return join(projectRoot, "node_modules", ".bin", name)
  } catch {
    return join(projectRoot, "node_modules", ".bin", name)
  }
}

const tsxBin = resolveBin("tsx")
const cliFile = join(projectRoot, "server", "cli.ts")

const child = spawn(process.execPath, [tsxBin, cliFile, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: "", PROJECT_ROOT: projectRoot },
})

child.on("exit", (code) => process.exit(code ?? 1))
