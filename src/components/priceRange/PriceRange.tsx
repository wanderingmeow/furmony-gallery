// src/components/priceRange/PriceRange.tsx - 价格区间: a histogram of the prices in the tab, and a
// slider with two ends over it.
//
// The grid holds its shape while the block is on screen, so nothing moves under a thumb that is
// mid-drag. A pair that reaches past this tab sits in one empty bar beyond the end.
import { createMemo, For, Show } from "solid-js";
import { DollarOutlined } from "@ant-design/icons-svg";
import { price } from "../../stores/derivedStore";
import { tr } from "../../i18n";
import { priceRange, setPriceRange } from "../../stores/filterStore";
import {
  barInside,
  edgeOf,
  isFullRange,
  otherEnd,
  priceRangeLabel,
  slideRange,
  snapRange,
  type PriceEnd,
  type PriceRange,
} from "../../model/priceRange";
import { AntIcon } from "../ui/AntIcon";
import { PANEL_BLOCK, PanelHeader, UNDER_TEXT } from "../fab/panelParts";
import { PriceRail } from "./PriceRail";

export function PriceRangeBlock() {
  // Fix the grid before the first bar is drawn.
  price.remount();
  const steps = price.steps;
  // A stored pair holds yuan from an earlier visit, and prices move between visits, so both ends
  // are read back through the steps this tab has now.
  const ends = createMemo<PriceRange | null>(() => {
    const full = price.full();
    if (!full || steps().length < 3) return null;
    const cur = priceRange() ?? full;
    return snapRange(steps(), cur[0], cur[1]);
  });
  const priced = createMemo(() =>
    price.bars().reduce((n, b) => n + b.count, 0),
  );
  const tallest = createMemo(() =>
    Math.max(1, ...price.bars().map((b) => b.count)),
  );
  // 4% keeps a bar with one listing visible next to a bar with two hundred.
  const tall = (count: number): string =>
    `${Math.max(4, (count / tallest()) * 100)}%`;

  /** The only place the filter is written. The dragged end goes to `index`; the other stays. */
  const moveTo = (end: PriceEnd, index: number): PriceRange | null => {
    const full = price.full();
    const cur = ends();
    if (!full || !cur) return null;
    const to = steps()[index] ?? full[0];
    const next =
      slideRange(steps(), end, to, edgeOf(cur, otherEnd(end))) ?? cur;
    // A pair over every bar filters nothing, so the store holds null. That keeps the count under
    // the slider and the 重置 row saying the same thing.
    setPriceRange(isFullRange(next, full) ? null : next);
    return next;
  };

  // A list with no price in it has no grid to draw, so the whole block stays out of the panel.
  return (
    <Show when={ends()}>
      {(ends) => (
        <div class={PANEL_BLOCK}>
          <PanelHeader icon={<AntIcon icon={DollarOutlined} />}>
            {tr("filter.priceRange")}
            {/* The corner is where every block shows what it is set to. */}
            <span class="ml-auto text-[11px] font-normal text-faint">
              {priceRangeLabel(ends())}
            </span>
          </PanelHeader>
          <div class={`pr-row mt-1 ${UNDER_TEXT}`}>
            {/* The bars are the picture and the slider is the control, so `aria-hidden` keeps a
                screen reader on the slider, where each end says its own price. */}
            <div class="pr-hist" aria-hidden="true">
              <For each={price.bars()}>
                {(b) => (
                  <div
                    class="pr-bar"
                    classList={{ "pr-bar-on": barInside(b, ends()) }}
                    style={{ height: tall(b.count) }}
                  />
                )}
              </For>
            </div>
            <PriceRail steps={steps()} ends={ends()} onMove={moveTo} />
            <div class="pr-count mt-1 mb-2 text-center text-[11px] text-muted">
              {tr("filter.bandCount", price.on() ? price.count() : priced())}
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
