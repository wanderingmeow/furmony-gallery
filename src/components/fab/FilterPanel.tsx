import { createSignal, For, Show } from 'solid-js'
import type { JSXElement } from 'solid-js'
import {
  ArrowDownOutlined, ArrowUpOutlined, BgColorsOutlined, BulbOutlined,
  ClockCircleOutlined, DollarOutlined, ExperimentOutlined, SettingOutlined, SortAscendingOutlined,
} from '@ant-design/icons-svg'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'
import {
  availableColors, availableRaces, selectedColors, setSelectedColors, selectedRaces, setSelectedRaces,
  priceMode, searchConfigured, semanticActive, setPriceMode, semanticOn, setSemanticSearch,
  setSortMode, sortMode,
} from '../../store'
import { PRICE_MODES, PRICE_MODE_LABELS, type PriceMode } from '../../model/domain'
import type { SortMode } from '../../model/filter'
import { SegmentedControl, type Segment } from '../ui/SegmentedControl'
import { AntIcon } from '../ui/AntIcon'
import { Switch } from '../ui/Switch'
import { SORT_BTN } from '../ui/boxes'

const COLOR_DOT: Record<string, string> = {
  红: 'bg-red-500', 橙: 'bg-orange-500', 黄: 'bg-yellow-500', 绿: 'bg-green-600',
  蓝: 'bg-blue-600', 紫: 'bg-purple-600', 黑: 'bg-black', 白: 'bg-white',
  灰: 'bg-gray-500', 棕: 'bg-amber-800', 褐: 'bg-[#59331a]', 粉: 'bg-pink-500', 青: 'bg-cyan-500',
}
const RACE_ICON: Record<string, string> = {
  狼: '🐺', 龙: '🐉', 东方龙: '🐉', 羊: '🐑', 虎: '🐯', 狮: '🦁', 豹: '🐆',
  狗: '🐕', 犬: '🐕', 龙犬: '🐕', 熊: '🐻', 猫: '🐱', 狐狸: '🦊', 神兽: '✨',
  神话: '✨', 兵器: '🗡️', 鱼: '🐟', 昆虫: '🦋', 植物: '🌿', 蛇: '🐍', 鸟: '🐦',
  兔: '🐰', 鹿: '🦌', 蝙蝠: '🦇', 神: '👑', 神秘生物: '❓',
}

/** Ant's arrow glyphs leave more room on one side, so turning one 180° makes a folding row
 *  jump. This one is centerd in its own box. */
function Chevron(props: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="10"
      height="10"
      aria-hidden="true"
      class="transition-transform"
      classList={{ 'rotate-180': props.open }}
    >
      <path
        d="M2.5 4.5 6 8 9.5 4.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

function toggleIn(cur: Set<string>, value: string): Set<string> {
  const next = new Set(cur)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

/** A header row: 6px of padding, a 12px glyph, an 8px gap, then its name. */
function PanelHeader(props: { icon: JSXElement; children: JSXElement }) {
  return (
    <div class="min-h-7 px-1.5 flex items-center gap-2 text-xs font-semibold">
      {props.icon} {props.children}
    </div>
  )
}

/** So section content starts under the name, not under the icon beside it: 6 + 12 + 8. */
const UNDER_TEXT = 'pl-[26px] pr-1.5'

/** The rule that keeps a block apart from what came before, so the panel reads as the same blocks
 *  whether or not the foldable sections above it are open. */
const PANEL_BLOCK = 'mt-1.5 pt-1.5 border-t border-border'

/**
 * A foldable list of choices. It starts shut when nothing is picked, and open when something is:
 * 颜色 and 物种 hold enough chips to push 价格显示 and the search switch past the panel's edge.
 */
function Section(props: {
  title: string
  icon: JSXElement
  items: string[]
  selected: Set<string>
  onToggle: (value: string) => void
  mark: (value: string) => JSXElement
}) {
  // The fold is set once, from the picks at the moment the panel opens, and only the reader moves
  // it after that. Following the picks live would close the section the instant its last pick is
  // cleared, under the finger that cleared it.
  const [open, setOpen] = createSignal(props.selected.size > 0)
  const fold = () => setOpen((o) => !o)
  return (
    <div class={PANEL_BLOCK}>
      <div class="flex items-center">
        <button
          class="flex-1 min-h-9 flex items-center gap-2 px-1.5 text-xs font-semibold"
          aria-expanded={open()}
          onClick={fold}
        >
          {props.icon} {props.title}
        </button>
        <span class="text-[10px] text-faint">{props.selected.size}/{props.items.length}</span>
        {/* The title button already folds the row and carries aria-expanded, so this is a
            second hit area and nothing else. */}
        <button
          class="w-7 h-9 flex items-center justify-center text-faint"
          aria-hidden="true"
          tabindex={-1}
          onClick={fold}
        >
          {/* Set by eye: the arrow shares no baseline with the digit count beside it. */}
          <span class="relative top-[1px] flex items-center">
            <Chevron open={open()} />
          </span>
        </button>
      </div>

      <Show when={open()}>
        <div class={`mt-1 ${UNDER_TEXT} flex flex-wrap gap-1`}>
          <For each={props.items}>
            {(v) => {
              const on = () => props.selected.has(v)
              return (
                <button
                  class="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs"
                  classList={{
                    'bg-accent/15 border-accent/40 text-accent-soft font-medium': on(),
                    'bg-surface border-border': !on(),
                  }}
                  aria-pressed={on()}
                  onClick={() => props.onToggle(v)}
                >
                  {props.mark(v)}
                  <span>{v}</span>
                </button>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}

// Each button flips between its own two directions and never cancels back to the other group.
const togglePrice = (current: SortMode): SortMode => (current === 'priceAsc' ? 'priceDesc' : 'priceAsc')
const toggleTime = (current: SortMode): SortMode => (current === 'timeDesc' ? 'timeAsc' : 'timeDesc')
const inGroup = (group: 'price' | 'time') => sortMode().startsWith(group)
// While a search answer is on screen the order is not ours to set, so no direction is shown.
export const priceIcon = (): IconDefinition =>
  inGroup('price') && !semanticActive()
    ? (sortMode() === 'priceAsc' ? ArrowUpOutlined : ArrowDownOutlined)
    : DollarOutlined
export const timeIcon = (): IconDefinition =>
  inGroup('time') && !semanticActive()
    ? (sortMode() === 'timeDesc' ? ArrowDownOutlined : ArrowUpOutlined)
    : ClockCircleOutlined

function SortBtn(props: {
  label: string
  on: () => boolean
  icon: () => IconDefinition
  disabled: () => boolean
  onClick: () => void
}) {
  // A search answer arrives ranked by how well it matches, and re-sorting it would undo that. The
  // buttons stay in place and go dead: a block that vanishes makes the panel look broken.
  const off = props.disabled
  return (
    <button
      class={`${SORT_BTN} flex-1 px-2 text-sm flex items-center justify-center gap-1`}
      classList={{
        'bg-accent/35 text-accent-soft': props.on() && !off(),
        'bg-surface-2 text-ink': !props.on() && !off(),
        'bg-surface-2 text-faint': off(),
      }}
      aria-pressed={props.on() && !off()}
      disabled={off()}
      onClick={props.onClick}
    >
      <AntIcon icon={props.icon} /> {props.label}
    </button>
  )
}

function SortBlock() {
  return (
    <>
      <PanelHeader icon={<AntIcon icon={SortAscendingOutlined} />}>排序</PanelHeader>
      <div class={`mt-1 mb-2 ${UNDER_TEXT} flex gap-2`}>
        <SortBtn label="价格" on={() => inGroup('price')} icon={priceIcon} disabled={semanticActive}
          onClick={() => setSortMode(togglePrice(sortMode()))} />
        <SortBtn label="时间" on={() => inGroup('time')} icon={timeIcon} disabled={semanticActive}
          onClick={() => setSortMode(toggleTime(sortMode()))} />
      </div>
    </>
  )
}

const PRICE_ITEMS: Segment<PriceMode>[] = PRICE_MODES.map((m) => ({
  value: m,
  label: PRICE_MODE_LABELS[m],
}))

function PriceModeBlock() {
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={SettingOutlined} />}>价格显示</PanelHeader>
      {/* The indent lives outside the bordered box: that box has an edge, and the edge is
          what lines up with the header's first letter. */}
      <div class={`mt-1 mb-2 ${UNDER_TEXT}`}>
        <SegmentedControl label="价格显示" fill
          value={priceMode} onChange={setPriceMode} items={PRICE_ITEMS} />
      </div>
    </div>
  )
}

function SemanticBlock() {
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={BulbOutlined} />}>
        设定搜索增强 <span class="text-[10px] px-1 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300">Beta</span>
        <div class="ml-auto">
          <Switch on={semanticOn()} onChange={setSemanticSearch} label="设定搜索增强" />
        </div>
      </PanelHeader>
      {/* Where what the reader sends goes, said once at the switch: a tooltip does not
          exist on a touch screen, and repeating it under every query would be noise. Every
          clause is true of the service, so none of it is softened. */}
      <div class={`mt-1 mb-2 ${UNDER_TEXT} text-[11px] leading-relaxed text-muted`}>
        <span class="block">语义和图像搜索由 Embedding 模型驱动，需要上传检索信息至服务器。</span>
        <span class="block">零数据保留（ZDR）：文字和图片只在服务器内存中用于生成结果，返回即消失，不被记录，也不用于模型训练。</span>
      </div>
    </div>
  )
}

// The panel the corner button opens: the order, then colors and species, then the two settings,
// 价格显示 and 设定搜索增强. Opening and closing the panel is FabMenu's business.
export function FilterPanel() {
  return (
    <div class="min-h-0 overflow-y-auto">
      <SortBlock />
      <Section
        title="颜色"
        icon={<AntIcon icon={BgColorsOutlined} />}
        items={availableColors()}
        selected={selectedColors()}
        onToggle={(v) => setSelectedColors(toggleIn(selectedColors(), v))}
        mark={(v) => <span class={`w-2.5 h-2.5 rounded-full shrink-0 border border-border/50 ${COLOR_DOT[v] ?? 'bg-gray-400'}`} />}
      />
      <Section
        title="物种"
        icon={<AntIcon icon={ExperimentOutlined} />}
        items={availableRaces()}
        selected={selectedRaces()}
        onToggle={(v) => setSelectedRaces(toggleIn(selectedRaces(), v))}
        mark={(v) => <span class="w-4 text-center">{RACE_ICON[v] ?? '❔'}</span>}
      />
      <PriceModeBlock />
      {/* A build without a search address hides the switch rather than offering a search that
          quietly does nothing. */}
      <Show when={searchConfigured}>
        <SemanticBlock />
      </Show>
    </div>
  )
}
