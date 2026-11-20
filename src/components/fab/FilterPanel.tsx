import { createSignal, For, Show, untrack } from 'solid-js'
import type { JSXElement } from 'solid-js'
import {
  ArrowDownOutlined, ArrowUpOutlined, BgColorsOutlined, BulbOutlined,
  ClockCircleOutlined, DollarOutlined, ExperimentOutlined, GlobalOutlined, SettingOutlined,
  SortAscendingOutlined,
  UserOutlined,
} from '@ant-design/icons-svg'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'
import {
  availableColors, availableRaces, panelHasChanges, resetPanel, socialCount, socialFilterOn,
  socialsReady,
} from '../../stores/derivedStore'
import {
  selectedColors, setSelectedColors, selectedRaces, setSelectedRaces, setSortMode, setSocialOnly,
  sortMode,
} from '../../stores/filterStore'
import { priceMode, setPriceMode, setSemanticSearch } from '../../stores/displayStore'
import { searchConfigured, semanticActive, semanticOn } from '../../stores/semanticStore'
import { PRICE_MODES, priceModeLabel, type PriceMode } from '../../model/domain'
import type { SortMode } from '../../model/filter'
import { SegmentedControl, type Segment } from '../ui/SegmentedControl'
import { ChoiceGrid } from '../ui/ChoiceGrid'
import { AntIcon } from '../ui/AntIcon'
import { Switch } from '../ui/Switch'
import { SORT_BTN } from '../ui/boxes'
import { tr } from '../../i18n'
import { LOCALES, LOCALE_NAME, requestedLocale, setLocale } from '../../i18n/locale'
import { colorLabel, raceLabelByName } from '../../i18n/glossary'
import { PANEL_BLOCK, PanelHeader, UNDER_NOTE, UNDER_TEXT } from './panelParts'
import { PriceRangeBlock } from '../priceRange'

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

/**
 * A foldable list of choices. It starts shut when nothing is picked, and open when something is: the
 * color and species blocks hold enough chips to push the price display and the search switch past
 * the panel's edge.
 */
function Section(props: {
  title: string
  icon: JSXElement
  items: string[]
  selected: Set<string>
  onToggle: (value: string) => void
  mark: (value: string) => JSXElement
  /** The word for a value in the language on screen. */
  label?: (value: string) => string
}) {
  // The fold is set once, from the picks at the moment the panel opens, and only the reader moves
  // it after that. Following the picks live would close the section the instant its last pick is
  // cleared, under the finger that cleared it.
  const [open, setOpen] = createSignal(untrack(() => props.selected.size) > 0)
  const fold = () => setOpen((o) => !o)
  return (
    <div class={PANEL_BLOCK}>
      {/* One button for the whole row, so the name, the count and the chevron all fold. The count
          sits where a thumb lands when the row already shows a pick, so it has to answer. */}
      <button
        class="w-full min-h-9 flex items-center gap-2 px-1.5 text-xs font-semibold"
        aria-expanded={open()}
        onClick={fold}
      >
        {props.icon} {props.title}
        {/* Inside the button, so a screen reader says the count with the row it describes. */}
        <span class="ml-auto text-[10px] font-normal text-faint">
          {props.selected.size}/{props.items.length}
        </span>
        <span class="w-7 flex items-center justify-center text-faint" aria-hidden="true">
          {/* Set by eye: the arrow shares no baseline with the digit count beside it. */}
          <span class="relative top-[1px] flex items-center">
            <Chevron open={open()} />
          </span>
        </span>
      </button>

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
                  <span>{props.label ? props.label(v) : v}</span>
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
      <PanelHeader icon={<AntIcon icon={SortAscendingOutlined} />}>{tr('filter.sort')}</PanelHeader>
      <div class={`mt-1 mb-2 ${UNDER_TEXT} flex gap-2`}>
        <SortBtn label={tr('sort.price')} on={() => inGroup('price')} icon={priceIcon} disabled={semanticActive}
          onClick={() => setSortMode(togglePrice(sortMode()))} />
        <SortBtn label={tr('sort.time')} on={() => inGroup('time')} icon={timeIcon} disabled={semanticActive}
          onClick={() => setSortMode(toggleTime(sortMode()))} />
      </div>
    </>
  )
}

/**
 * The owner-account switch. Only a small share of the listings have an owner account, so the line
 * names the count before the reader cuts the list down to it.
 *
 * The switch reads `socialFilterOn` and writes `socialOnly`. The two differ when socials.json is
 * missing: the row is gray, the list is unfiltered, and a switch the reader left on is kept for the
 * case where the table does arrive.
 */
function OwnerBlock() {
  const note = () => socialsReady()
    ? tr('filter.socialNote', socialCount())
    : tr('filter.socialMissing')
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={UserOutlined} />}>
        {tr('filter.socialOnly')}
        <div class="ml-auto">
          <Switch on={socialFilterOn()} onChange={setSocialOnly}
            label={tr('filter.socialOnly')} disabled={!socialsReady()} />
        </div>
      </PanelHeader>
      <div class={UNDER_NOTE}>
        <span class="block">{note()}</span>
      </div>
    </div>
  )
}

const priceItems = (): Segment<PriceMode>[] =>
  PRICE_MODES.map((m) => ({ value: m, label: priceModeLabel(m) }))

function PriceModeBlock() {
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={SettingOutlined} />}>{tr('filter.priceMode')}</PanelHeader>
      {/* The indent lives outside the bordered box: that box has an edge, and the edge is
          what lines up with the header's first letter. */}
      <div class={`mt-1 mb-2 ${UNDER_TEXT}`}>
        <SegmentedControl label={tr('filter.priceMode')} fill
          value={priceMode} onChange={setPriceMode} items={priceItems()} />
      </div>
    </div>
  )
}

function SemanticBlock() {
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={BulbOutlined} />}>
        {tr('filter.enhance')} <span class="text-[10px] px-1 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300">Beta</span>
        <div class="ml-auto">
          <Switch on={semanticOn()} onChange={setSemanticSearch} label={tr('filter.enhance')} />
        </div>
      </PanelHeader>
      {/* Where what the reader sends goes, said once at the switch: a tooltip does not
          exist on a touch screen, and repeating it under every query would be noise. Every
          clause is true of the service, so none of it is softened. */}
      <div class={UNDER_NOTE}>
        {/* One line, kept on one source line: JSX turns a break between Chinese characters into
            a visible space, and there is no space to spare before （ZDR）. */}
        <span class="block">{tr('filter.enhanceNote')}</span>
      </div>
    </div>
  )
}

/**
 * The language of the interface and of the words the API returns translated. Four names in four
 * scripts have no room side by side, so they take two rows of two.
 */
function LanguageBlock() {
  const items = LOCALES.map((code) => ({ value: code, label: LOCALE_NAME[code] }))
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={GlobalOutlined} />}>{tr('filter.language')}</PanelHeader>
      <div class={`mt-1 mb-2 ${UNDER_TEXT}`}>
        {/* The tick follows the pick, not the page: the reader just chose this, and the translated
            words arrive a moment later. */}
        <ChoiceGrid label={tr('filter.language')} columns={2}
          value={requestedLocale} onChange={setLocale} items={items} />
      </div>
    </div>
  )
}

/**
 * 重置, in red because this is the row that takes things away. `resetPanel` says what it gives back.
 *
 *  The row stays and goes gray when there is nothing to take back. A row that arrived and left at
 *  the foot of the panel would push the note above it up and down while the reader worked.
 */
function ResetRow() {
  return (
    <div class={PANEL_BLOCK}>
      <button
        class="w-full min-h-7 px-1.5 text-right text-xs font-semibold
               text-red-500 dark:text-red-400 disabled:text-faint"
        disabled={!panelHasChanges()}
        onClick={resetPanel}
      >{tr('filter.reset')}</button>
    </div>
  )
}

// The panel the corner button opens. It owns the padding and the scrolling, so the blocks run to the
// glass edge and `FabMenu` only has to draw the box.
export function FilterPanel() {
  return (
    <div class="no-pick min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
      <SortBlock />
      <Section
        title={tr('filter.colors')}
        icon={<AntIcon icon={BgColorsOutlined} />}
        items={availableColors()}
        label={colorLabel}
        selected={selectedColors()}
        onToggle={(v) => setSelectedColors(toggleIn(selectedColors(), v))}
        mark={(v) => <span class={`w-2.5 h-2.5 rounded-full shrink-0 border border-border/50 ${COLOR_DOT[v] ?? 'bg-gray-400'}`} />}
      />
      <Section
        title={tr('filter.races')}
        icon={<AntIcon icon={ExperimentOutlined} />}
        items={availableRaces()}
        label={raceLabelByName}
        selected={selectedRaces()}
        onToggle={(v) => setSelectedRaces(toggleIn(selectedRaces(), v))}
        mark={(v) => <span class="w-4 text-center">{RACE_ICON[v] ?? '❔'}</span>}
      />
      <OwnerBlock />
      <PriceRangeBlock />
      <PriceModeBlock />
      {/* A build without a search address hides the switch rather than offering a search that
          quietly does nothing. */}
      <Show when={searchConfigured}>
        <SemanticBlock />
      </Show>
      <LanguageBlock />
      <ResetRow />
    </div>
  )
}
