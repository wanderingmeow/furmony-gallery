import { tr } from "../i18n";
import {
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
  type JSX,
} from "solid-js";
import { CloseOutlined } from "@ant-design/icons-svg";
import type uPlot from "uplot";
import { listings } from "../stores/listingsStore";
import {
  StatBarChart,
  StatHistChart,
  StatLineChart,
} from "../components/stats/StatChart";
import {
  filterByLock,
  priceBins,
  priceEdges,
  colorCounts,
  raceCounts,
  monthlyPriceStats,
  monthlyCounts,
  fmtMonth,
  medianPrice,
  STATS_PRICE_BUCKET,
  LOCK_FILTERS,
  lockLabel,
  type LockFilter,
} from "../model/statistics";
import { formatPrice } from "../model/domain";
import { statsTitle } from "../model/titles";
import { displayPrice } from "../model/domain";
import { AntIcon } from "../components/ui/AntIcon";
import { SheetFab } from "../components/ui/SheetFab";
import {
  SegmentedControl,
  type Segment,
} from "../components/ui/SegmentedControl";
import { SHEET_HEADER_ROW, SHEET_TITLE } from "../components/ui/boxes";

// One color per chart: price in blue, color in mint, species in green, monthly additions in orange.
const PRICE_BLUE = "#3b82f6";
const COLOR_MINT = "#14b8a6";
const RACE_GREEN = "#22c55e";
const MONTH_ORANGE = "#f97316";

const lockItems = (): Segment<LockFilter>[] =>
  LOCK_FILTERS.map((f) => ({ value: f, label: lockLabel(f) }));

/**
 * The header of the statistics sheet: the ✕, the title, and the switch between all the
 * listings, the locked ones and the unlocked ones. It sits in this lazy file next to the
 * charts, so the sheet opens on the placeholder and everything real arrives together.
 */
export function StatsHeader(props: {
  mode: () => LockFilter;
  setMode: (m: LockFilter) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div class={SHEET_HEADER_ROW}>
      <SheetFab label={tr("common.close")} onClick={props.onClose}>
        <AntIcon icon={CloseOutlined} size={22} />
      </SheetFab>
      <h1 class={SHEET_TITLE}>{statsTitle()}</h1>
      <SegmentedControl
        class="ml-auto"
        label={tr("stats.lockState")}
        value={props.mode}
        onChange={props.setMode}
        items={lockItems()}
      />
    </div>
  );
}

/**
 * The charts. uplot and @dschz/solid-uplot arrive with this file, so they stay out of the
 * first screen. StatsSheet puts this inside the sheet's own scroller.
 */
export function Stats(props: { mode: () => LockFilter; onClose: () => void }) {
  const data = createMemo(() => filterByLock(listings(), props.mode()));

  // the content owns Esc, because this is the one screen with a sheet of its own
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", handler);
    onCleanup(() => document.removeEventListener("keydown", handler));
  });

  // ---- price ----
  const prices = createMemo(() =>
    data()
      .map(displayPrice)
      .filter((p) => p > 0),
  );
  const bins = createMemo(() => priceBins(prices(), STATS_PRICE_BUCKET));
  // Hovering/clicking any chart refreshes its section's summary span (the top-right
  // `ml-auto` one) with the hovered data point's value - it doubles as the tooltip.
  const [priceHover, setPriceHover] = createSignal<number | null>(null);
  const priceSummary = createHoverSummary(
    bins,
    priceHover,
    (b) =>
      tr(
        "stats.band",
        `${Math.round(b.low / 1000)}k`,
        `${Math.round(b.high / 1000)}k`,
        b.count,
      ),
    () => {
      const ps = prices();
      if (ps.length === 0) return "";
      const avg = Math.round(ps.reduce((a, p) => a + p, 0) / ps.length);
      const median = Math.round(medianPrice(ps));
      return tr("stats.avgMedian", formatPrice(avg), formatPrice(median));
    },
  );

  // ---- color ----
  const colors = createMemo(() => colorCounts(data()));
  const [colorHover, setColorHover] = createSignal<number | null>(null);
  const colorSummary = createHoverSummary(
    colors,
    colorHover,
    (c) => `${c.name}: ${tr("stats.times", c.count)}`,
    (es) =>
      tr(
        "stats.totalTimes",
        es.reduce((a, e) => a + e.count, 0),
      ),
  );

  // ---- race ----
  const races = createMemo(() => raceCounts(data()));
  const [raceHover, setRaceHover] = createSignal<number | null>(null);
  const raceSummary = createHoverSummary(
    races,
    raceHover,
    (r) => `${r.name}: ${tr("stats.count", r.count)}`,
    (es) =>
      tr(
        "stats.totalListings",
        es.reduce((a, e) => a + e.count, 0),
      ),
  );

  // ---- the two monthly charts ----
  //
  // Both charts read one month axis. The count chart has every month that a listing was created
  // in. The price chart skips a month whose listings are all unpriced, so building the axis from
  // the count chart leaves holes in the price line. Month i then means the same month at the
  // same pixel in both charts.
  const monthly = createMemo(() => monthlyCounts(data()));
  const months = createMemo(() => monthly().map((s) => s.label));
  const monthlyPrice = createMemo(() => monthlyPriceStats(data()));
  const priceMonths = createMemo(() => {
    const avg = new Map(monthlyPrice().map((s) => [s.label, s.avg]));
    return months().map((m) => ({ label: m, avg: avg.get(m) ?? null }));
  });
  const [hoverMonth, setHoverMonth] = createSignal<string | null>(null);

  const hoverIndex = createMemo(() => {
    const m = hoverMonth();
    if (m === null) return null;
    const i = months().indexOf(m);
    return i < 0 ? null : i;
  });

  const charts: (uPlot | null)[] = [null, null];
  // Which chart the pointer is inside. The chart that the pointer leaves reports a null hover
  // after the chart being entered has drawn its own line, and that null would clear the new line.
  let owner = -1;
  const showMonth = (self: number, idx: number | null): void => {
    if (idx === null && owner !== self) return;
    owner = idx === null ? -1 : self;
    setHoverMonth(idx === null ? null : (months()[idx] ?? null));
    const src = charts[self];
    const other = charts[1 - self];
    if (!src || !other) return;
    // The other chart gets the number the source cursor already holds. setCursor reads that same
    // number, so both lines land on one pixel. A position says where the pointer sits between two
    // months, so the line follows it there. A negative left hides the line, and the second
    // argument stops the other chart from reporting the move back.
    other.setCursor(
      { left: idx === null ? -1 : (src.cursor.left ?? -1), top: -1 },
      false,
    );
  };

  const monthlyPriceSummary = createHoverSummary(
    priceMonths,
    hoverIndex,
    (s) =>
      `${fmtMonth(s.label)}: ${s.avg === null ? tr("price.noPrice") : formatPrice(s.avg)}`,
    (es) => tr("stats.months", es.filter((s) => s.avg !== null).length),
  );

  const monthlySummary = createHoverSummary(
    monthly,
    hoverIndex,
    (m) => `${fmtMonth(m.label)}: ${tr("stats.count", m.count)}`,
    (es) =>
      tr(
        "stats.totalListings",
        es.reduce((a, e) => a + e.count, 0),
      ),
  );

  return (
    <div class="flex flex-col gap-3">
      <StatSection
        title={tr("stats.onceDistribution")}
        summary={priceSummary()}
      >
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

      <StatSection
        title={tr("stats.colorDistribution")}
        summary={colorSummary()}
      >
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

      <StatSection title={tr("stats.raceDistribution")} summary={raceSummary()}>
        <Show when={races().length > 0} fallback={<NoData />}>
          <StatBarChart
            labels={races().map((r) => r.name)}
            values={races().map((r) => r.count)}
            color={RACE_GREEN}
            showTicks={false}
            showAllLabels
            onHover={setRaceHover}
          />
        </Show>
      </StatSection>

      <StatSection title={tr("stats.monthAvg")} summary={monthlyPriceSummary()}>
        <Show when={monthlyPrice().length > 0} fallback={<NoData />}>
          <StatLineChart
            labels={months()}
            values={priceMonths().map((s) => s.avg)}
            color={PRICE_BLUE}
            onReady={(u) => {
              charts[0] = u;
            }}
            onHover={(i) => showMonth(0, i)}
          />
        </Show>
      </StatSection>

      <StatSection title={tr("stats.monthCount")} summary={monthlySummary()}>
        <Show when={monthly().length > 0} fallback={<NoData />}>
          <StatBarChart
            labels={months()}
            values={monthly().map((s) => s.count)}
            color={MONTH_ORANGE}
            onReady={(u) => {
              charts[1] = u;
            }}
            onHover={(i) => showMonth(1, i)}
          />
        </Show>
      </StatSection>
    </div>
  );
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
    const e = entries();
    const h = hover();
    if (h != null && e[h] != null) return fmtHover(e[h], h);
    return fmtTotal(e);
  });
}

function StatSection(props: {
  title: string;
  summary: string;
  children: JSX.Element;
}) {
  return (
    <div class="rounded-xl bg-surface border border-border p-3">
      <div class="flex items-center gap-2 mb-2">
        <span class="font-semibold text-sm text-ink">{props.title}</span>
        <span class="ml-auto text-xs text-muted">{props.summary}</span>
      </div>
      {props.children}
    </div>
  );
}

function NoData() {
  return (
    <div class="text-sm text-muted py-8 text-center">{tr("stats.noData")}</div>
  );
}
