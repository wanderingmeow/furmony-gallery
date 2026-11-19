// src/components/fab/PriceRange.tsx - 价格区间: a histogram of the prices in the tab, and a slider
// with two ends over it. The block reads `price` and writes back through `setPriceRange`.
//
// The grid holds its shape for as long as the block is on screen, so nothing moves under a thumb
// that is mid-drag. A pair that reaches past this tab sits in one empty bar beyond the end.
import { createMemo, createSignal, For, Show } from 'solid-js'
import { DollarOutlined } from '@ant-design/icons-svg'
import { price } from '../../stores/derivedStore'
import { tr } from '../../i18n'
import { priceRange, setPriceRange } from '../../stores/filterStore'
import { formatPrice } from '../../model/domain'
import { barInside, isFullRange, priceRangeLabel, snapRange, type PriceRange } from '../../model/priceRange'
import { AntIcon } from '../ui/AntIcon'
import { PANEL_BLOCK, PanelHeader, UNDER_TEXT } from './panelParts'
import './PriceRange.css'

export function PriceRangeBlock() {
  // Chosen once, here, before the first bar is drawn.
  price.remount()
  const steps = price.steps
  // The stored pair is yuan from a previous visit, and prices move between visits, so both ends are
  // read back through the steps the tab has now.
  const ends = createMemo<PriceRange | null>(() => {
    const full = price.full()
    if (!full || steps().length < 3) return null
    const cur = priceRange() ?? full
    return snapRange(steps(), cur[0], cur[1])
  })
  const at = (value: number): number => steps().indexOf(value)
  const priced = createMemo(() => price.bars().reduce((n, b) => n + b.count, 0))
  const tallest = createMemo(() => Math.max(1, ...price.bars().map((b) => b.count)))
  // 4% keeps a bar with one listing visible next to a bar with two hundred.
  const tall = (count: number): string => `${Math.max(4, (count / tallest()) * 100)}%`
  const share = (value: number): string => String(at(value) / (steps().length - 1))

  // Either thumb can be grabbed wherever the two sit, so a finger sometimes lands on the thumb the
  // reader did not mean to take. The pressed end grows at once and eases back on release, so the
  // block shows which end the finger holds.
  const [grabbed, setGrabbed] = createSignal<'low' | 'high' | null>(null)
  const grab = (which: 'low' | 'high') => () => setGrabbed(which)
  const release = () => setGrabbed(null)

  const move = (which: 'low' | 'high', index: number): void => {
    const full = price.full()
    const cur = ends()
    if (!full || !cur) return
    const lo = which === 'low' ? index : at(cur[0])
    const hi = which === 'high' ? index : at(cur[1])
    const next = snapRange(steps(), steps()[lo] ?? full[0], steps()[hi] ?? full[1])
    // A pair over every bar filters nothing, so the store holds null. That keeps the count under the
    // slider and the 重置 row saying the same thing. Dragging both ends out reaches this state, and
    // so does 重置.
    setPriceRange(next && !isFullRange(next, full) ? next : null)
  }

  // A list with no price in it has no grid to draw, so the whole block stays out of the panel.
  return (
    <Show when={ends()}>
      {(ends) => (
        <div class={PANEL_BLOCK}>
          <PanelHeader icon={<AntIcon icon={DollarOutlined} />}>
            {tr('filter.priceRange')}
            {/* The corner is where every block shows what it is set to. */}
            <span class="ml-auto text-[11px] font-normal text-faint">{priceRangeLabel(ends())}</span>
          </PanelHeader>
          {/* The bars are the picture. The slider is the control, and `aria-hidden` on the bars
              keeps a screen reader on the slider, where each end says its own price. */}
          <div class={`mt-1 ${UNDER_TEXT}`}>
            <div class="pr-hist" aria-hidden="true">
              <For each={price.bars()}>
                {(b) => (
                  <div
                    class="pr-bar"
                    classList={{ 'pr-bar-on': barInside(b, ends()) }}
                    style={{ height: tall(b.count) }}
                  />
                )}
              </For>
            </div>
            <div class="pr-slide" style={{ '--lo': share(ends()[0]), '--hi': share(ends()[1]) }}>
              <div class="pr-rail" />
              <div class="pr-band" />
              {/* Near the right end the low thumb sits on top of the high one, so the reader can
                  still press the low end when the two ends are together there. */}
              <input
                class="pr-thumb" classList={{ 'pr-grab': grabbed() === 'low' }}
                type="range" aria-label={tr('filter.priceMin')}
                min={0} max={steps().length - 1} step={1} value={at(ends()[0])}
                style={{
                  'z-index': grabbed() === 'low' ? 4 : at(ends()[0]) > (steps().length - 1) / 2 ? 3 : 2,
                }}
                aria-valuetext={formatPrice(ends()[0])}
                onPointerDown={grab('low')}
                onPointerUp={release}
                onPointerCancel={release}
                onBlur={release}
                onInput={(e) => move('low', Number(e.currentTarget.value))}
              />
              <input
                class="pr-thumb" classList={{ 'pr-grab': grabbed() === 'high' }}
                type="range" aria-label={tr('filter.priceMax')}
                min={0} max={steps().length - 1} step={1} value={at(ends()[1])}
                style={{ 'z-index': grabbed() === 'high' ? 4 : 2 }}
                aria-valuetext={formatPrice(ends()[1])}
                onPointerDown={grab('high')}
                onPointerUp={release}
                onPointerCancel={release}
                onBlur={release}
                onInput={(e) => move('high', Number(e.currentTarget.value))}
              />
            </div>
            <div class="pr-count mt-1 mb-2 text-center text-[11px] text-muted">
              {tr('filter.bandCount', price.on() ? price.count() : priced())}
            </div>
          </div>
        </div>
      )}
    </Show>
  )
}
