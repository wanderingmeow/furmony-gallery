import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import type { JSXElement } from 'solid-js'
import { Portal } from 'solid-js/web'
import { BgColorsOutlined, FilterOutlined } from '@ant-design/icons-svg'
import {
  availableColors, availableRaces, selectedColors, setSelectedColors, selectedRaces, setSelectedRaces,
} from '../store'
import { AntIcon } from './AntIcon'

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

function toggleColor(c: string): void {
  const cur = selectedColors()
  const next = new Set(cur)
  if (next.has(c)) next.delete(c)
  else next.add(c)
  setSelectedColors(next)
}

function toggleRace(r: string): void {
  const cur = selectedRaces()
  const next = new Set(cur)
  if (next.has(r)) next.delete(r)
  else next.add(r)
  setSelectedRaces(next)
}

function Column(props: {
  title: string
  icon: JSXElement
  items: string[]
  selected: Set<string>
  toggle: (v: string) => void
  dot?: (v: string) => string
  iconOf?: (v: string) => string
}) {
  const [q, setQ] = createSignal('')
  const filtered = () => {
    const s = q().toLowerCase()
    return props.items.filter((i) => i.toLowerCase().includes(s))
  }
  return (
    <div class="w-37.5 sm:w-55 flex flex-col">
      <input
        value={q()}
        onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
        placeholder="筛选…"
        class="h-7 px-2 my-1 mx-1.5 rounded bg-gray-100 outline-none text-xs"
      />
      <div class="flex items-center px-1.5 pt-0.5">
        <span class="text-xs font-semibold flex items-center gap-1">{props.icon} {props.title}</span>
        <span class="ml-auto text-[10px] text-gray-400">({props.selected.size}/{props.items.length})</span>
      </div>
      <div class="max-h-60 overflow-y-auto px-1">
        <Show
          when={filtered().length > 0}
          fallback={<div class="text-xs text-gray-400 px-1.5 py-2">无匹配</div>}
        >
          {filtered().map((v) => {
            const sel = () => props.selected.has(v)
            return (
              <button
                class="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-xs"
                classList={{ 'bg-blue-500/15': sel() }}
                onClick={() => props.toggle(v)}
              >
                <span class={sel() ? 'text-blue-600' : 'text-gray-400'}>{sel() ? '✓' : '○'}</span>
                <Show when={props.iconOf}><span class="w-4 text-center">{props.iconOf!(v)}</span></Show>
                <Show when={props.dot}>
                  <span class={`w-2.5 h-2.5 rounded-full shrink-0 border border-black/20 ${props.dot!(v)}`} />
                </Show>
                <span>{v}</span>
              </button>
            )
          })}
        </Show>
      </div>
    </div>
  )
}

export function ColorRacePicker() {
  const [open, setOpen] = createSignal(false)
  const active = () => selectedColors().size > 0 || selectedRaces().size > 0
  const count = () => selectedColors().size + selectedRaces().size

  let wrap!: HTMLDivElement
  let popup!: HTMLDivElement
  const [pos, setPos] = createSignal<{ top: number; right: number } | null>(null)

  // popup is Portaled to <body> so its backdrop-filter can sample the page behind
  // it — nested inside the toolbar's own `.glass` (backdrop-filter), CSS would clip
  // it to the toolbar's backdrop root and blur would never show. Compute fixed coords.
  createEffect(() => {
    if (!open()) { setPos(null); return }
    const measure = () => {
      const r = wrap.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    onCleanup(() => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    })
  })

  // close the popup when clicking anywhere outside it / the toggle button
  createEffect(() => {
    if (!open()) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrap && wrap.contains(t)) return
      if (popup && popup.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('click', handler, true)
    onCleanup(() => document.removeEventListener('click', handler, true))
  })

  return (
    <div class="relative" ref={wrap}>
      <button
        class="h-8 px-2 rounded-lg text-sm flex items-center gap-1"
        classList={{
          'bg-blue-600 text-white shadow-sm': open(),
          'bg-orange-500 text-white shadow-sm': !open() && active(),
          'bg-gray-200/70 text-gray-600': !open() && !active(),
        }}
        onClick={() => setOpen((o) => !o)}
        aria-label="筛选"
        title="筛选"
      >
        <AntIcon icon={FilterOutlined} />
        <Show when={active()}>
          <span class="min-w-3.5 h-4 px-1 rounded-full bg-white text-orange-600 text-[10px] font-bold flex items-center justify-center">
            {count()}
          </span>
        </Show>
      </button>
      <Show when={open() && pos()}>
        <Portal>
          <div
            ref={popup}
            class="fixed z-50 glass rounded-xl shadow-xl p-2 flex flex-col border border-black/10"
            style={{ top: `${pos()!.top}px`, right: `${pos()!.right}px`, 'backdrop-filter': 'blur(24px) saturate(200%)', '-webkit-backdrop-filter': 'blur(24px) saturate(200%)', background: 'rgba(255,255,255,0.75)' }}
          >
          <div class="flex gap-1">
            <Column
              title="颜色" icon={<AntIcon icon={BgColorsOutlined} />}
              items={availableColors()} selected={selectedColors()} toggle={toggleColor}
              dot={(v) => COLOR_DOT[v] ?? 'bg-gray-400'}
            />
            <div class="w-px bg-black/10" />
            <Column
              title="物种" icon={<span>🧬</span>}
              items={availableRaces()} selected={selectedRaces()} toggle={toggleRace}
              iconOf={(v) => RACE_ICON[v] ?? '❔'}
            />
          </div>
          {/* shared clear-all: shown only when something is selected */}
          <Show when={count() > 0}>
            <button
              class="text-[11px] text-red-600 py-1.5 mx-auto"
              onClick={() => { setSelectedColors(new Set<string>()); setSelectedRaces(new Set<string>()) }}
            >
              清除全部
            </button>
          </Show>
          </div>
        </Portal>
      </Show>
    </div>
  )
}
