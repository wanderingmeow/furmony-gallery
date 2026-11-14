// 右下角 FAB 列里的一个圆钮，加它自己的弹出面板。
//
// 面板只能往上开（下沿停在自家按钮上方 8px）：这些钮贴在屏幕角上，往下开就掉出屏幕。
// 面板 Portal 到 <body>：在瀑布流的固定层里再套一层 .glass，backdrop-filter 会被外层图
// 层裁掉，模糊出不来。
import { createEffect, createSignal, onCleanup, Show, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'
import { AntIcon } from '../ui/AntIcon'

export function FabMenu(props: {
  label: string
  icon: IconDefinition | (() => IconDefinition)
  /** 高亮 + 右上角数字：让「筛选开着 N 项」在收起面板时也看得见 */
  badge?: () => number
  active?: () => boolean
  panelClass?: string
  children?: JSX.Element
}) {
  const [open, setOpen] = createSignal(false)
  const active = () => props.active?.() ?? false
  const badge = () => props.badge?.() ?? 0

  let wrap!: HTMLDivElement
  let popup!: HTMLDivElement
  const [pos, setPos] = createSignal<{ bottom: number; right: number; room: number } | null>(null)

  createEffect(() => {
    if (!open()) { setPos(null); return }
    // 每次量都重新算：FAB 列会因为「回到顶部」出现/消失而整体上下移动
    const measure = () => {
      const r = wrap.getBoundingClientRect()
      // room = how much screen is left above the button, minus the 8px gap and some air.
      setPos({
        bottom: window.innerHeight - r.top + 8,
        right: window.innerWidth - r.right,
        room: r.top - 16,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    onCleanup(() => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    })
  })

  // 面板浮在列表上方，所以「点别处」和 Esc 都得能关掉它（捕获阶段监听，避免被卡片
  // 自己的 click 拦掉）
  createEffect(() => {
    if (!open()) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrap.contains(t) || popup.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey)
    onCleanup(() => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey)
    })
  })

  return (
    <div class="relative" ref={wrap}>
      <button
        class="relative w-12 h-12 rounded-full shadow shadow-neutral-600/40 flex items-center justify-center text-xl border"
        classList={{
          'bg-orange-500 text-white border-orange-600/40': active() || open(),
          'bg-surface text-ink border-border': !active() && !open(),
        }}
        aria-label={props.label}
        aria-expanded={open()}
        title={props.label}
        onClick={() => setOpen((o) => !o)}
      >
        <AntIcon icon={props.icon} size="1.25em" />
        <Show when={badge() > 0}>
          <span class="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-surface text-orange-600 text-[9px] font-bold flex items-center justify-center border border-border">
            {badge()}
          </span>
        </Show>
      </button>

      <Show when={open() && pos()}>
        <Portal>
          <div
            ref={popup}
            // A column, so a panel can put its own scroller on the content and keep a row
            // (like 重置) pinned at the bottom instead of scrolling it in and out.
            class={`fixed z-40 glass rounded-xl shadow-xl border border-black/10 p-2 flex flex-col ${props.panelClass ?? ''}`}
            // A long panel scrolls inside itself instead of running off the top of the screen.
            style={{ bottom: `${pos()!.bottom}px`, right: `${pos()!.right}px`,
              'max-height': `${pos()!.room}px`, 'overflow-y': 'auto' }}
          >
            {props.children}
          </div>
        </Portal>
      </Show>
    </div>
  )
}
