import { ConfigProvider } from "@/context/ConfigProvider"
import { ToastContainer } from "@/components/ui/toast"
import Dashboard from "@/pages/Dashboard"

export default function App() {
  return (
    <ConfigProvider>
      <Dashboard />
      <ToastContainer />
    </ConfigProvider>
  )
}
