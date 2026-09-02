import { SolidUplot } from '@dschz/solid-uplot'
import { cursor } from '@dschz/solid-uplot/plugins'
import uPlot from 'uplot'
import type { AlignedData } from 'uplot'

// Unified chart height (Swift StatisticsView: every chart is 200px)
export const STAT_CHART_H = 200

// uPlot's default axis stroke is black (#000) and grid is rgba(0,0,0,0.07) —
// both are invisible/wrong on the dark surface. Resolve the palette once at
// module load so axes/grid/labels follow the current mode.
const isDark =
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
const AXIS_STROKE = isDark ? '#a3a3a3' : '#6b7280'
const GRID_STROKE = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
// Axis ticks OUTSIDE the plot: same color & width as the grid (they used to be a
// darker stroke), and shorter (size 4 vs uPlot's default 10).
const TICKS = { stroke: GRID_STROKE, width: 2, size: 4 }
// Axis value labels: smaller than uPlot's default 12px.
const AXIS_FONT = '10px ui-sans-serif, system-ui, sans-serif'

// uPlot has no native bar renderer — use the built-in `paths.bars` factory.
// align:0 CENTERS each bar on its x tick (xShift = barWid/2), so labels/cursor
// line up with the bar's middle — align:1 leaves xShift≈0 (bar's LEFT edge at
// the tick) and the bar drifts right by half a width.
function barPaths() {
  return uPlot.paths.bars!({ align: 0, radius: 0.3, size: [0.9, 100] })
}

// Pad the x scale by half a slot so edge bars aren't clipped — with align:0 the
// FIRST bar sits at the plot's left edge (right half shown) and the LAST bar at
// the right edge (left half shown). Padding also gives the histogram's boundary
// labels room.
function xScales(): uPlot.Scales {
  return {
    x: { range: (_u: uPlot, min: number, max: number): [number, number] => [min - 0.5, max + 0.5] },
  }
}

// Categorical x-axis. `labels` is a GETTER so the axis picks up new labels on
// every redraw. Options:
//  - maxLabels: cap how many labels fit (adaptive stride, offset keeps the FIRST).
//  - showAllLabels: show every bar's label (stride 1) — color/species.
//  - showTicks: draw tick marks (false for color/species — just labels).
//  - showGrid: draw uPlot's native vertical gridlines (false for bar charts —
//    we draw them at the bar SIDES instead, via the draw hook).
//  - rotate: label rotation in degrees (45 = bottom-left → top-right diagonal).
//  - size: axis height in px (needs extra room for rotated labels).
//
// `incrs:[1]` + tiny `space` force ONE tick per bar (uPlot's default `space:50`
// picked an increment ≥2 and skipped bars); `values` maps over uPlot's `splits`
// (the bar indices it placed ticks at) returning ONE label per split.
function catAxis(
  labels: () => string[],
  opts: { maxLabels?: number; showTicks?: boolean; showAllLabels?: boolean; showGrid?: boolean; rotate?: number; size?: number } = {},
): uPlot.Axis {
  const maxLabels = opts.showAllLabels ? Infinity : (opts.maxLabels ?? 6)
  const showTicks = opts.showTicks !== false
  const showGrid = opts.showGrid !== false
  const rotate = opts.rotate ?? 0
  const stride = () => {
    const len = labels().length
    return len <= maxLabels ? 1 : Math.ceil(len / maxLabels)
  }
  return {
    stroke: AXIS_STROKE,
    grid: { show: showGrid, stroke: GRID_STROKE },
    ticks: { ...TICKS, show: showTicks },
    font: AXIS_FONT,
    space: 2,
    incrs: [1],
    rotate,
    size: opts.size ?? 26, // snug - labels (10px) + gap 5 + ticks 4
    gap: 6, // labels close to the axis
    // offset 0 keeps the LEFTMOST label (uPlot's default offset keeps the last).
    values: (_self: uPlot, splits: number[], _axisIdx: number, _foundSpace: number, _foundIncr: number) => {
      const l = labels()
      const s = stride()
      const out = splits.map((v: number) => (s === 1 || v % s === 0) ? (l[v] ?? '') : '')
      return out
    },
  }
}

// Price histogram axis: the tick labels are the bin EDGES (16k / 18k / 20k ...)
// and each bar sits BETWEEN two consecutive edges. Custom `splits` places ticks/
// labels at the boundaries (-0.5, 0.5, 1.5, ...), so the gridlines naturally fall
// on the bar SIDES; `values` maps each boundary to its edge name.
function histAxis(edges: () => string[], opts: { maxLabels?: number; showAllLabels?: boolean } = {}): uPlot.Axis {
  const maxLabels = opts.showAllLabels ? Infinity : (opts.maxLabels ?? 10)
  const stride = () => {
    const n = edges().length
    return n <= maxLabels ? 1 : Math.ceil(n / maxLabels)
  }
  return {
    stroke: AXIS_STROKE,
    grid: { stroke: GRID_STROKE },
    ticks: { ...TICKS },
    font: AXIS_FONT,
    rotate: 90, // vertical labels (counterclockwise 90°)
    space: 2,
    gap: 5, // labels close to the axis
    size: 34, // snug — vertical labels need ~20px + gap 5 + ticks 4
    splits: (_self: uPlot, _axisIdx: number, _min: number, _max: number, _incr: number, _space: number) => {
      const n = edges().length - 1 // number of bars
      const arr: number[] = []
      for (let i = 0; i <= n; i++) arr.push(i - 0.5)
      return arr
    },
    values: (_self: uPlot, splits: number[], _axisIdx: number, _foundSpace: number, _foundIncr: number) => {
      const e = edges()
      const s = stride()
      return splits.map((v: number) => {
        const idx = Math.round(v + 0.5)
        return (s === 1 || idx % s === 0) ? (e[idx] ?? '') : ''
      })
    },
  }
}

// Shared y-axis (counts) — keeps the horizontal gridlines.
function yAxis(): uPlot.Axis {
  return { stroke: AXIS_STROKE, grid: { stroke: GRID_STROKE }, ticks: { ...TICKS }, font: AXIS_FONT, size: 34 }
}

// Y-axis for the monthly price line — labels in 千元 (integer thousand, e.g. 12k)
// with FINE gridlines down to 2k. `space` is dropped to 12 so uPlot accepts a
// 2000 increment (default 50 rejects it → no splits); labels stay at every 4000
// so the grid is dense (2k) without cluttering labels. `size` reserves room.
function yAxisK(): uPlot.Axis {
  return {
    stroke: AXIS_STROKE,
    grid: { stroke: GRID_STROKE },
    ticks: { ...TICKS },
    font: AXIS_FONT,
    space: 12,
    incrs: [2000, 4000, 8000],
    size: 36,
    values: (_self: uPlot, splits: number[]) =>
      splits.map((v: number) => (v % 4000 === 0 ? `${Math.round(v / 1000)}k` : '')),
  }
}

// Vertical gridlines at the BAR SIDES (boundaries) — uPlot draws them at the bar
// centers (its splits), so for the bar charts we disable the native grid and draw
// these ourselves at i-0.5 (between bars). Positions are device px (same space as
// the canvas context, which uPlot renders at full device resolution).
function drawBarGrid(u: uPlot) {
  const ctx = u.ctx
  const n = u.data[0]?.length ?? 0
  if (!ctx || n === 0) return
  const bb = u.bbox
  ctx.save()
  ctx.strokeStyle = GRID_STROKE
  ctx.lineWidth = (typeof window !== 'undefined' ? window.devicePixelRatio : 1)
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const x = u.valToPos(i - 0.5, 'x', true)
    ctx.moveTo(x, bb.top)
    ctx.lineTo(x, bb.top + bb.height)
  }
  ctx.stroke()
  ctx.restore()
}

// Draw the COUNT above each bar (uPlot has no built-in data labels). Runs in the
// `draw` hook — after series/axes — so the numbers sit on top of the bars.
function drawBarLabels(u: uPlot) {
  const ctx = u.ctx
  const xs = u.data[0]
  const ys = u.data[1]
  if (!ctx || !xs || !ys || xs.length !== ys.length) return
  const pr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
  ctx.save()
  ctx.font = `${8 * pr}px ui-sans-serif, system-ui, sans-serif`
  ctx.fillStyle = AXIS_STROKE
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  for (let i = 0; i < ys.length; i++) {
    const x = u.valToPos(xs[i] as number, 'x', true)
    const y = u.valToPos(ys[i] as number, 'y', true) - 3 * pr
    ctx.fillText(String(ys[i]), x, y)
  }
  ctx.restore()
}

// Amount label — 千元, one decimal (xx.xk).
export function fmtK(v: number): string {
  return `${(v / 1000).toFixed(1)}k`
}

// hex "#rrggbb" -> rgba with a given alpha (for semi-transparent area fills).
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// Bar charts (颜色/物种/每月新增): gridlines at bar sides + count labels.
function barChartHooks(): uPlot.Hooks.Arrays {
  return { draw: [drawBarGrid, drawBarLabels] }
}

// Histogram (价格分布): count labels only (its native grid already sits on the
// bar sides via the boundary splits).
function histHooks(): uPlot.Hooks.Arrays {
  return { draw: [drawBarLabels] }
}

// `data`/`series`/`axes` are GETTERS so SolidUplot's `setData` effect tracks them
// (passing snapshots froze the chart at first render — it never re-drew on filter
// change). `scales`/`hooks` are static.
function chart(
  data: () => AlignedData,
  series: () => uPlot.Series[],
  axes: () => uPlot.Axis[],
  scales: () => uPlot.Scales,
  hooks?: () => uPlot.Hooks.Arrays,
  onCursorMove?: (params: { cursor: { idx: number } }) => void,
  onMouseLeave?: () => void,
  plugins?: unknown[],
) {
  return (
    <div class="w-full" style={{ height: `${STAT_CHART_H}px` }} onMouseLeave={onMouseLeave}>
      <SolidUplot
        autoResize
        data={data()}
        series={series()}
        axes={axes()}
        scales={scales()}
        hooks={hooks?.()}
        plugins={plugins as any}
        onCursorMove={onCursorMove}
        padding={[4, 8, 0, 0]} // minimal top margin + a bit more room on the right
      />
    </div>
  )
}

// Bar chart (颜色分布 / 物种分布 / 每月新增) — gridlines at bar sides, count above
// each bar; every label or adaptive stride; optional ticks; optional 45° rotated
// labels (物种).
export function StatBarChart(props: {
  labels: string[]; values: number[]; color: string; maxLabels?: number; showTicks?: boolean; showAllLabels?: boolean; rotate?: number; axisSize?: number; onHover?: (idx: number | null) => void
}) {
  const data = (): AlignedData => [props.labels.map((_, i) => i), props.values]
  const series = (): uPlot.Series[] => [
    {},
    { label: '数量', stroke: props.color, fill: props.color, paths: barPaths(), points: { show: false } },
  ]
  const axes = (): uPlot.Axis[] => [
    catAxis(() => props.labels, { maxLabels: props.maxLabels, showTicks: props.showTicks, showAllLabels: props.showAllLabels, showGrid: false, rotate: props.rotate ?? 0, size: props.axisSize ?? 26 }),
    yAxis(),
  ]
  return chart(data, series, axes, xScales, barChartHooks, (p) => props.onHover?.(p.cursor.idx >= 0 ? p.cursor.idx : null), () => props.onHover?.(null), [cursor()])
}

// Price histogram (一次性支付价格) — edge labels with bars BETWEEN them; count above
// each bar. `edges` = bin boundaries (one more than the bars), `values` = counts.
export function StatHistChart(props: {
  edges: string[]; values: number[]; color: string; maxLabels?: number; showAllLabels?: boolean; onHover?: (idx: number | null) => void
}) {
  const n = () => Math.max(0, props.edges.length - 1)
  const data = (): AlignedData => [Array.from({ length: n() }, (_, i) => i), props.values]
  const series = (): uPlot.Series[] => [
    {},
    { label: '数量', stroke: props.color, fill: props.color, paths: barPaths(), points: { show: false } },
  ]
  const axes = (): uPlot.Axis[] => [histAxis(() => props.edges, { maxLabels: props.maxLabels, showAllLabels: props.showAllLabels }), yAxis()]
  return chart(data, series, axes, xScales, histHooks, (p) => props.onHover?.(p.cursor.idx >= 0 ? p.cursor.idx : null), () => props.onHover?.(null), [cursor()])
}

// Line + area chart (每月价格走势) — 千元 y-axis, adaptive stride, native gridlines
// at the data points. No per-point labels (too cluttered); instead `onHover`
// reports the hovered/clicked point index (or null) so the parent can refresh the
// section's summary span. `onMouseLeave` resets to null when the cursor exits.
export function StatLineChart(props: {
  labels: string[]; values: number[]; color: string; maxLabels?: number; onHover?: (idx: number | null) => void
}) {
  const data = (): AlignedData => [props.labels.map((_, i) => i), props.values]
  const series = (): uPlot.Series[] => [
    {},
    { label: '均价', stroke: props.color, fill: withAlpha(props.color, 0.15), width: 2, points: { show: true } },
  ]
  const axes = (): uPlot.Axis[] => [catAxis(() => props.labels, { maxLabels: props.maxLabels }), yAxisK()]
  return chart(
    data,
    series,
    axes,
    xScales,
    undefined,
    (p) => props.onHover?.(p.cursor.idx >= 0 ? p.cursor.idx : null),
    () => props.onHover?.(null),
    [cursor()],
  )
}
