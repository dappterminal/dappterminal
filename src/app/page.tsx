import { CLI } from "@/components/cli"
import { ChartsPanel } from "@/components/charts-panel"

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* CLI - 70% width */}
      <CLI className="w-[70%]" />

      {/* Charts Panel - 30% width */}
      <ChartsPanel className="w-[30%]" />
    </div>
  )
}
