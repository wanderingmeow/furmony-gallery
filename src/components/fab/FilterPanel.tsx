import { createSignal, For, Show } from 'solid-js'
import type { JSXElement } from 'solid-js'
import {
  BgColorsOutlined, BulbOutlined, ClearOutlined, ExperimentOutlined, SettingOutlined,
} from '@ant-design/icons-svg'
import {
  availableColors, availableRaces, selectedColors, setSelectedColors, selectedRaces, setSelectedRaces,
  priceMode, searchConfigured, setPriceMode, semanticOn, setSemanticSearch,
} from '../../store'
import { PRICE_MODES, PRICE_MODE_LABELS, type PriceMode } from '../../model/domain'
import { SEG_ITEM, SEG_ITEM_STATE, SEG_ROW } from '../ui/segment'
import { AntIcon } from '../ui/AntIcon'
import { Switch } from '../ui/Switch'

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
 *  jump. This one is centred in its own box. */
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

/** A foldable list of choices. Starts open, so the picks already made stay visible. */
function Section(props: {
  title: string
  icon: JSXElement
  items: string[]
  selected: Set<string>
  onToggle: (value: string) => void
  onClear: () => void
  mark: (value: string) => JSXElement
}) {
  const [open, setOpen] = createSignal(true)
  return (
    <div class="mt-1.5 pt-1.5 border-t border-border">
      <div class="flex items-center">
        <button
          class="flex-1 min-h-9 flex items-center gap-2 px-1.5 text-xs font-semibold"
          aria-expanded={open()}
          onClick={() => setOpen((o) => !o)}
        >
          {props.icon} {props.title}
        </button>
        {/* This clears the block it sits in. 价格显示 is a display mode, not a filter, so it
            has no clear button of its own. */}
        <Show when={props.selected.size > 0}>
          <button
            class="w-9 h-9 flex items-center justify-center rounded-lg text-faint hover:text-red-600"
            aria-label={`清除已选${props.title}`}
            title={`清除已选${props.title}`}
            onClick={props.onClear}
          >
            <AntIcon icon={ClearOutlined} size="1em" />
          </button>
        </Show>
        <span class="text-[10px] text-faint">{props.selected.size}/{props.items.length}</span>
        {/* The title button already folds the row and carries aria-expanded, so this is a
            second hit area and nothing else. */}
        <button
          class="w-7 h-9 flex items-center justify-center text-faint"
          aria-hidden="true"
          tabindex={-1}
          onClick={() => setOpen((o) => !o)}
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
                    'bg-blue-500/15 border-blue-400/50 text-blue-700 font-medium': on(),
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

// The panel behind the 筛选 button: the 设定搜索 switch, then 价格显示, then colours and
// species. Opening and closing the panel is FabMenu's business.
export function FilterPanel() {
  return (
    // The panel's one scroll area. 重置 lives outside it, so it stays under the thumb and
    // clearing filters never moves it.
    <div class="min-h-0 overflow-y-auto">
      {/* A build without a search address hides the switch rather than offering a search that
          quietly does nothing. */}
      <Show when={searchConfigured}>
        <PanelHeader icon={<AntIcon icon={BulbOutlined} />}>
          设定搜索 <span class="text-[10px] px-1 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300">Beta</span>
          <div class="ml-auto">
            <Switch on={semanticOn()} onChange={setSemanticSearch} label="设定搜索" />
          </div>
        </PanelHeader>
        {/* Where what the reader sends goes, said once at the switch: a tooltip does not
            exist on a touch screen, and repeating it under every query would be noise. Every
            clause is true of the service, so none of it is softened. */}
        <div class={`mt-1 mb-2 ${UNDER_TEXT} text-[11px] leading-relaxed text-muted`}>
          <span class="block">语义和图像搜索由 Embedding 模型驱动，需要上传检索信息至服务器。</span>
          <span class="block">零数据保留（ZDR）：文字和图片只在服务器内存中用于生成结果，返回即消失，不被记录，也不用于模型训练。</span>
        </div>
      </Show>

      <PanelHeader icon={<AntIcon icon={SettingOutlined} />}>价格显示</PanelHeader>
      {/* The indent lives outside the bordered box: that box has an edge, and the edge is
          what lines up with the header's first letter. */}
      <div class={`mt-1 ${UNDER_TEXT}`}>
        <div class={`flex ${SEG_ROW}`}>
          <For each={PRICE_MODES}>
            {(m: PriceMode) => {
              const on = () => priceMode() === m
              return (
                <button
                  class={`flex-1 py-2 ${SEG_ITEM}`}
                  classList={SEG_ITEM_STATE(on())}
                  aria-pressed={on()}
                  onClick={() => setPriceMode(m)}
                >
                  {PRICE_MODE_LABELS[m]}
                </button>
              )
            }}
          </For>
        </div>
      </div>

      <Section
        title="颜色"
        icon={<AntIcon icon={BgColorsOutlined} />}
        items={availableColors()}
        selected={selectedColors()}
        onToggle={(v) => setSelectedColors(toggleIn(selectedColors(), v))}
        onClear={() => setSelectedColors(new Set<string>())}
        mark={(v) => <span class={`w-2.5 h-2.5 rounded-full shrink-0 border border-border/50 ${COLOR_DOT[v] ?? 'bg-gray-400'}`} />}
      />
      <Section
        title="物种"
        icon={<AntIcon icon={ExperimentOutlined} />}
        items={availableRaces()}
        selected={selectedRaces()}
        onToggle={(v) => setSelectedRaces(toggleIn(selectedRaces(), v))}
        onClear={() => setSelectedRaces(new Set<string>())}
        mark={(v) => <span class="w-4 text-center">{RACE_ICON[v] ?? '❔'}</span>}
      />
    </div>
  )
}
