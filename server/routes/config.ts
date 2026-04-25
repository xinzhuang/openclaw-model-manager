import path from "node:path"
import fs from "node:fs"
import { Router } from "express"
import { getConfigPath, listWorkspaceAgents, readConfig, writeConfig, patchConfig, getConfigHash } from "../utils/config.js"

const router = Router()

router.get("/config", (_req, res) => {
  try {
    const config = readConfig()
    const baseHash = getConfigHash()
    res.json({ config, baseHash })
  } catch (err) {
    res.status(500).json({ message: (err as Error).message })
  }
})

// Read auth-profiles.json for a specific agent
router.get("/config/agents/:agentId/auth-profiles", (req, res) => {
  try {
    const { agentId } = req.params
    const agentsFromConfig = listWorkspaceAgents()
    const agent = agentsFromConfig.find((a) => a.id === agentId)

    if (!agent) {
      // Try to construct the path from agentId
      const agentDir = path.join(process.env.HOME || "", ".openclaw", "agents", agentId, "agent")
      const authPath = path.join(agentDir, "auth-profiles.json")
      if (!fs.existsSync(authPath)) {
        return res.json({ profiles: {} })
      }
      const raw = fs.readFileSync(authPath, "utf-8")
      return res.json({ profiles: JSON.parse(raw).profiles || {} })
    }

    if (!agent.agentDir) {
      return res.json({ profiles: {} })
    }

    const authPath = path.join(agent.agentDir, "auth-profiles.json")
    if (!fs.existsSync(authPath)) {
      return res.json({ profiles: {} })
    }

    const raw = fs.readFileSync(authPath, "utf-8")
    res.json({ profiles: JSON.parse(raw).profiles || {} })
  } catch (err) {
    res.status(500).json({ message: (err as Error).message })
  }
})

router.post("/config", (req, res) => {
  try {
    const { config, baseHash } = req.body
    writeConfig(config, { baseHash })
    res.json({ success: true, baseHash: getConfigHash() })
  } catch (err) {
    res.status(500).json({ message: (err as Error).message })
  }
})

router.patch("/config", (req, res) => {
  try {
    const { patch, baseHash } = req.body
    patchConfig(patch, { baseHash })
    res.json({ success: true, baseHash: getConfigHash() })
  } catch (err) {
    res.status(500).json({ message: (err as Error).message })
  }
})

// Read per-agent models.json
router.get("/config/agents/:agentId/models", (req, res) => {
  try {
    const { agentId } = req.params
    const modelsPath = path.join(
      process.env.HOME || "", ".openclaw", "agents", agentId, "agent", "models.json"
    )
    if (!fs.existsSync(modelsPath)) {
      return res.json({ providers: {} })
    }
    const raw = fs.readFileSync(modelsPath, "utf-8")
    const data = JSON.parse(raw)
    res.json({ providers: data.providers || {} })
  } catch (err) {
    res.status(500).json({ message: (err as Error).message })
  }
})

// Update a provider in per-agent models.json
router.put("/config/agents/:agentId/models/:providerId", (req, res) => {
  try {
    const { agentId, providerId } = req.params
    const providerConfig = req.body
    const modelsPath = path.join(
      process.env.HOME || "", ".openclaw", "agents", agentId, "agent", "models.json"
    )

    let data: any = { providers: {} }
    if (fs.existsSync(modelsPath)) {
      data = JSON.parse(fs.readFileSync(modelsPath, "utf-8"))
    }

    if (!data.providers) data.providers = {}
    data.providers[providerId] = providerConfig

    // Atomic write
    const dir = path.dirname(modelsPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(modelsPath, JSON.stringify(data, null, 2) + "\n", "utf-8")

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: (err as Error).message })
  }
})

// Delete a provider from per-agent models.json
router.delete("/config/agents/:agentId/models/:providerId", (req, res) => {
  try {
    const { agentId, providerId } = req.params
    const modelsPath = path.join(
      process.env.HOME || "", ".openclaw", "agents", agentId, "agent", "models.json"
    )

    if (!fs.existsSync(modelsPath)) {
      return res.json({ success: true })
    }

    const data = JSON.parse(fs.readFileSync(modelsPath, "utf-8"))
    if (data.providers?.[providerId]) {
      delete data.providers[providerId]
      fs.writeFileSync(modelsPath, JSON.stringify(data, null, 2) + "\n", "utf-8")
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: (err as Error).message })
  }
})

router.get("/config/path", (_req, res) => {
  res.json({ path: getConfigPath() })
})

router.get("/config/agents/discovered", (_req, res) => {
  try {
    res.json(listWorkspaceAgents())
  } catch (err) {
    res.status(500).json({ message: (err as Error).message })
  }
})

export default router
