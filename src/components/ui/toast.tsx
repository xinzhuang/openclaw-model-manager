import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"

type ToastType = "success" | "error" | "warning"

interface Toast {
  id: number
  message: string
  type: ToastType
}

let toastId = 0
const listeners: Array<(toast: Toast) => void> = []

export function showToast(message: string, type: ToastType = "success") {
  const toast: Toast = { id: ++toastId, message, type }
  listeners.forEach((fn) => fn(toast))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast])
  }, [])

  useEffect(() => {
    listeners.push(addToast)
    return () => {
      const idx = listeners.indexOf(addToast)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [addToast])

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className={cn(
        "animate-slide-in rounded-md border px-4 py-3 text-sm shadow-lg",
        toast.type === "success" && "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400",
        toast.type === "error" && "border-destructive/50 bg-destructive/10 text-destructive",
        toast.type === "warning" && "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
      )}
    >
      {toast.message}
    </div>
  )
}
