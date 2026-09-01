import { listings, isLoading } from '../store'

// Tier 2 — statistics deferred. Placeholder page.
export function Stats() {
  return (
    <div class="min-h-screen bg-canvas flex items-center justify-center">
      <div class="text-center text-muted">
        <div class="text-lg font-medium mb-2">数据统计</div>
        <div class="text-sm">
          {isLoading() ? '加载中…' : `共 ${listings().length} 个设定`}
        </div>
        <div class="text-xs mt-1 opacity-60">统计图表（Chart.js）将在 Tier 2 实现</div>
      </div>
    </div>
  )
}
