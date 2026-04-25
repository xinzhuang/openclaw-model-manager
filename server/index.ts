import path from "node:path"
import express from "express"
import cors from "cors"
import configRoutes from "./routes/config.js"

const app = express()
const PORT = process.env.PORT || 3457

app.use(cors())
app.use(express.json({ limit: "10mb" }))

app.use("/api", configRoutes)

if (process.env.NODE_ENV === "production") {
  const distPath = new URL("../dist", import.meta.url).pathname
  app.use(express.static(distPath))
  app.get("{*path}", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"))
  })
}

app.listen(PORT, () => {
  console.log(`OpenClaw Model Config API running on http://localhost:${PORT}`)
})
