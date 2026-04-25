#!/usr/bin/env node
import { spawn } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")

// Resolve tsx binary from local node_modules
const require = createRequire(import.meta.url)
let tsxBin
try {
  const tsxPkg = require.resolve("tsx/package.json", { paths: [projectRoot] })
  tsxBin = join(tsxPkg, "..", "dist", "cli.mjs")
} catch {
  tsxBin = join(projectRoot, "node_modules", ".bin", "tsx")
}

const cliFile = join(projectRoot, "server", "cli.ts")

const child = spawn(process.execPath, [tsxBin, cliFile, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: "" },
})

child.on("exit", (code) => process.exit(code ?? 1))
