import { createMemo, createSignal, onCleanup, onMount, Show, type JSX } from 'solid-js'
import { listings } from '../store'
import { StatBarChart, StatHistChart, StatLineChart } from '../components/StatChart'
import {
  filterByLock, priceBins, priceEdges, colorCounts, raceCounts, monthlyPriceStats, monthlyCounts,
  fmtMonth, medianPrice, type LockFilter,
} from '../statistics'
import { displayPrice } from '../domain'

// Swift palette per chart: 价格蓝 / 颜色 mint / 物种绿 / 每月橙
const PRICE_BLUE = '#3b82f6'
const COLOR_MINT = '#14b8a6'
const RACE_GREEN = '#22c55e'
const MONTH_ORANGE = '#f97316'

// Lazy-loaded content — uplot + @dschz/solid-uplot load only when /stats is
// opened. Rendered inside StatsSheet (the sheet owns the chrome + close button).
export function Stats(props: { mode: () => LockFilter; onClose: () => void }) {
  const data = createMemo(() => filterByLock(listings(), props.mode()))

  // Esc closes the stats sheet. The content owns the key (not the shared Sheet)
  // so deferral logic stays local; the Sheet no longer handles Esc globally.
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    document.addEventListener('keydown', handler)
    onCleanup(() => document.removeEventListener('keydown', handler))
  })

  // ---- price ----
  const prices = createMemo(() => data().map(displayPrice).filter((p) => p > 0))
  const bins = createMemo(() => priceBins(prices()))
  // Hovering/clicking any chart refreshes its section's summary span (the top-right
  // `ml-auto` one) with the hovered data point's value — it doubles as the tooltip.
  const [priceHover, setPriceHover] = createSignal<number | null>(null)
  const priceSummary = createHoverSummary(
    bins, priceHover,
    (b) => `${Math.round(b.low / 1000)}k-${Math.round(b.high / 1000)}k: ${b.count} 个`,
    () => {
      const ps = prices()
      if (ps.length === 0) return ''
      const avg = Math.round(ps.reduce((a, p) => a + p, 0) / ps.length)
      const median = Math.round(medianPrice(ps))
      return `均值 ¥${avg} | 中位 ¥${median}`
    },
  )

  // ---- color ----
  const colors = createMemo(() => colorCounts(data()))
  const [colorHover, setColorHover] = createSignal<number | null>(null)
  const colorSummary = createHoverSummary(
    colors, colorHover,
    (c) => `${c.name}: ${c.count} 次`,
    (es) => `共 ${es.reduce((a, e) => a + e.count, 0)} 次出现`,
  )

  // ---- race ----
  const races = createMemo(() => raceCounts(data()))
  const [raceHover, setRaceHover] = createSignal<number | null>(null)
  const raceSummary = createHoverSummary(
    races, raceHover,
    (r) => `${r.name}: ${r.count} 个`,
    (es) => `共 ${es.reduce((a, e) => a + e.count, 0)} 个设定`,
  )

  // ---- monthly price (line+area) ----
  const monthlyPrice = createMemo(() => monthlyPriceStats(data()))
  const [monthlyPriceHover, setMonthlyPriceHover] = createSignal<number | null>(null)
  const monthlyPriceSummary = createHoverSummary(
    monthlyPrice, monthlyPriceHover,
    (s) => `${fmtMonth(s.label)}: ¥${Math.round(s.avg)}`,
    (es) => {
      const ps = prices()
      const avg = ps.length ? Math.round(ps.reduce((a, p) => a + p, 0) / ps.length) : 0
      return `共 ${es.length} 个月 | 总均值 ¥${avg}`
    },
  )

  // ---- monthly count (bars) ----
  const monthly = createMemo(() => monthlyCounts(data()))
  const [monthHover, setMonthHover] = createSignal<number | null>(null)
  const monthlySummary = createHoverSummary(
    monthly, monthHover,
    (m) => `${fmtMonth(m.label)}: ${m.count} 个`,
    (es) => `共 ${es.reduce((a, e) => a + e.count, 0)} 个设定`,
  )

  return (
    <div class="flex flex-col gap-3">
      <StatSection title="一次性支付价格分布" summary={priceSummary()}>
          <Show when={bins().length > 0} fallback={<NoData />}>
            <StatHistChart
              edges={priceEdges(bins()).map((e) => `${Math.round(e / 1000)}k`)}
              values={bins().map((b) => b.count)}
              color={PRICE_BLUE}
              showAllLabels
              onHover={setPriceHover}
            />
          </Show>
        </StatSection>

        <StatSection title="颜色分布" summary={colorSummary()}>
          <Show when={colors().length > 0} fallback={<NoData />}>
            <StatBarChart
              labels={colors().map((c) => c.name)}
              values={colors().map((c) => c.count)}
              color={COLOR_MINT}
              showTicks={false}
              showAllLabels
              onHover={setColorHover}
            />
          </Show>
        </StatSection>

        <StatSection title="物种分布" summary={raceSummary()}>
          <Show when={races().length > 0} fallback={<NoData />}>
            <StatBarChart
              labels={races().map((r) => r.name)}
              values={races().map((r) => r.count)}
              color={RACE_GREEN}
              showTicks={false}
              showAllLabels
              rotate={45}
              axisSize={48}
              onHover={setRaceHover}
            />
          </Show>
        </StatSection>

        <StatSection title="每月新增设定价格" summary={monthlyPriceSummary()}>
          <Show when={monthlyPrice().length > 0} fallback={<NoData />}>
            <StatLineChart labels={monthlyPrice().map((s) => s.label)} values={monthlyPrice().map((s) => s.avg)} color={PRICE_BLUE} onHover={setMonthlyPriceHover} />
          </Show>
        </StatSection>

        <StatSection title="每月新增设定" summary={monthlySummary()}>
          <Show when={monthly().length > 0} fallback={<NoData />}>
            <StatBarChart labels={monthly().map((s) => s.label)} values={monthly().map((s) => s.count)} color={MONTH_ORANGE} onHover={setMonthHover} />
          </Show>
        </StatSection>
    </div>
  )
}

// Shared hover→summary derivation for every chart section: a hovered data point
// wins (tooltip-style), otherwise the aggregate line. `entries`/`hover` are
// reactive getters; the two formatters build the hovered vs aggregate strings.
function createHoverSummary<T>(
  entries: () => T[],
  hover: () => number | null,
  fmtHover: (entry: T, idx: number) => string,
  fmtTotal: (entries: T[]) => string,
): () => string {
  return createMemo(() => {
    const e = entries()
    const h = hover()
    if (h != null && e[h] != null) return fmtHover(e[h], h)
    return fmtTotal(e)
  })
}

function StatSection(props: { title: string; summary: string; children: JSX.Element }) {
  return (
    <div class="rounded-xl bg-surface border border-border p-3">
      <div class="flex items-center gap-2 mb-2">
        <span class="font-semibold text-sm text-ink">{props.title}</span>
        <span class="ml-auto text-xs text-muted">{props.summary}</span>
      </div>
      {props.children}
    </div>
  )
}

function NoData() {
  return <div class="text-sm text-muted py-8 text-center">无数据</div>
}
