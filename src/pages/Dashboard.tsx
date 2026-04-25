import { useEffect, useRef, useState } from "react"
import { Header } from "@/components/layout/Header"
import { Providers } from "@/components/providers/Providers"
import { Agents } from "@/components/agents/Agents"

export default function Dashboard() {
  const [mounted, setMounted] = useState(false)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        <div
          ref={leftRef}
          className={`
            w-1/2 overflow-y-auto border-r border-border/50 p-4
            transition-all duration-500 ease-out
            ${mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}
          `}
        >
          <Providers agentId={selectedAgentId ?? undefined} />
        </div>
        <div
          ref={rightRef}
          className={`
            w-1/2 overflow-y-auto p-4
            transition-all duration-500 ease-out delay-150
            ${mounted ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}
          `}
        >
          <Agents onAgentSelect={setSelectedAgentId} />
        </div>
      </main>
    </div>
  )
}
