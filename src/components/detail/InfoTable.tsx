import { createEffect, createMemo, createSignal, For, Show, type JSXElement } from 'solid-js'
import type { AdoptListing } from '../../model/types'
import {
  colorNames, formatPrice, isAdopted, isLocked, painterAvatar, painterName, priceParts, raceName,
  type InstallmentPrice, type OncePrice,
} from '../../model/domain'
import { stableImageUrl } from '../../data/image'
import { priceMode, socials } from '../../store'
import { StatusBadge } from '../ui/StatusBadge'

// The first column is the head picture's width (w-15 is 60px), so values start under the title
const GRID = 'grid grid-cols-[60px_1fr] gap-3'

// 首付 and 月供 share this width, which is what lines their numbers up
const LABEL = 'w-8 shrink-0'

function Row(props: { label: string; children: JSXElement }) {
  return (
    <div class={`${GRID} border-t border-border mt-1.5 pt-1.5`}>
      <span class="text-xs text-muted pt-1">{props.label}</span>
      {/* 24px is one line of body text, so a row of badges is not shorter than a row of
          words. items-center keeps a 20.5px badge in the middle of that line, and grid
          rather than flex leaves the child full width, which lets the colour chips wrap. */}
      <div class="min-w-0 min-h-6 grid items-center">{props.children}</div>
    </div>
  )
}

function OptRow(props: { label: string; when: boolean; children: JSXElement }) {
  return (
    <Show when={props.when}>
      <Row label={props.label}>{props.children}</Row>
    </Show>
  )
}

function HeadImg(props: { url?: string }) {
  const [loaded, setLoaded] = createSignal(false)
  const [failed, setFailed] = createSignal(false)

  // Opening another listing does not remount this component: url changes while loaded()
  // still holds true from the previous picture, so the new image would leave a hole.
  createEffect(() => {
    props.url
    setLoaded(false)
    setFailed(false)
  })

  const box = 'w-15 h-15 rounded-lg bg-surface-2 shrink-0'
  const spinner = <div class="spinner w-4 h-4" />
  return (
    <Show
      when={props.url}
      fallback={<span class={`${box} flex items-center justify-center`}>{spinner}</span>}
    >
      {(url) => (
        <div class={`relative ${box} overflow-hidden`}>
          <Show when={!loaded()}>
            <div class="absolute inset-0 flex items-center justify-center">{spinner}</div>
          </Show>
          <img
            src={url()}
            alt=""
            class="w-full h-full rounded-lg object-cover border-2 border-border shadow transition-opacity duration-200"
            classList={{ 'opacity-0': !loaded(), hidden: failed() }}
            onLoad={() => setLoaded(true)}
            onError={() => { setLoaded(true); setFailed(true) }}
          />
        </div>
      )}
    </Show>
  )
}

function OncePriceLine(props: { parts: () => OncePrice }) {
  const p = props.parts
  return (
    <div class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
      <span class="text-lg font-bold text-orange-600">{formatPrice(p().main)}</span>
      <Show when={p().secondary}>{(total) => (
        <span class="text-sm text-faint line-through">{formatPrice(total())}</span>
      )}</Show>
      <Show when={p().discount > 0}>
        <span class="px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[11px] font-bold">
          {p().discount.toFixed(1)}折
        </span>
      </Show>
    </div>
  )
}

/**
 * Only 首付 is highlighted: a reader decides whether to keep looking based on it. The
 * pay-at-once comparison stays out of here, because readers take the two numbers and
 * subtract them by hand.
 */
function InstallmentPlan(props: { parts: () => InstallmentPrice }) {
  const p = props.parts
  return (
    <div class="mb-1.5 flex flex-col gap-0.5">
      <Show when={p().down}>{(down) => (
        <div class="flex items-baseline gap-x-1">
          {/* CJK glyphs sit 1~2px lower than digits on the same baseline. The lift is in
              em, so it follows the label's size. */}
          <span class={`${LABEL} text-sm font-medium text-orange-600 relative -top-[0.1em]`}>首付</span>
          <span class="text-xl font-bold text-orange-600 tabular-nums">{formatPrice(down())}</span>
        </div>
      )}</Show>
      <div class="flex flex-wrap items-baseline gap-x-2 text-xs text-muted tabular-nums">
        <Show when={p().main}>{(main) => (
          <span class="flex items-baseline gap-x-1">
            <span class={LABEL}>{p().mainLabel}</span>
            <span>{formatPrice(main())}</span>
          </span>
        )}</Show>
        <Show when={p().note}>{(note) => <span class="text-faint">{note()}</span>}</Show>
        <Show when={p().total}>{(total) => <span>共 {formatPrice(total())}</span>}</Show>
      </div>
    </div>
  )
}

export function InfoTable(props: { listing: AdoptListing }) {
  // A component body runs once, so we pass accessors down: opening listing B must update
  // the rows that are already on screen.
  const l = () => props.listing
  const parts = createMemo(() => priceParts(l(), priceMode()))
  const plan = createMemo(() => {
    const p = parts()
    return p?.mode === 'installment' ? p : null
  })
  const once = createMemo(() => {
    const p = parts()
    return p?.mode === 'once' ? p : null
  })
  const owner = createMemo(() => socials().get(l().adoptId)?.ownerName)
  const colors = createMemo(() => colorNames(l()))
  // isLock on the wire: 2 = locked, 1 = locking (deposit unpaid), 0 = free
  const lock = createMemo(() =>
    l().isLock === 1 ? { text: '锁定中', color: 'amber' as const }
      : isLocked(l()) ? { text: '已锁定', color: 'red' as const }
        : { text: '未锁定', color: 'green' as const })
  const adopted = createMemo(() => isAdopted(l()))

  return (
    <div class="rounded-xl bg-surface border border-border p-3">
      <div class={`${GRID} items-start`}>
        <HeadImg url={stableImageUrl(l().adoptHeadPicture)} />
        <div class="min-w-0">
          <div class="flex items-baseline gap-2">
            <h2 class="text-xl font-bold truncate">{l().adoptName ?? '未知'}</h2>
            <span class="text-sm text-muted shrink-0">#{l().adoptId}</span>
          </div>
          <Show when={plan()}>{(p) => <InstallmentPlan parts={p} />}</Show>
          <Show when={once()}>{(p) => <OncePriceLine parts={p} />}</Show>
        </div>
      </div>

      {/* We load socials per detail page, so 主人 shows only when that table has this id */}
      <OptRow label="主人" when={!!owner()}>{owner()}</OptRow>

      <Show when={l().harmonyPainterVo}>
        <Row label="画师">
          <div class="flex items-center gap-1.5">
            <Show when={painterAvatar(l())} fallback={<span class="w-6 h-6 rounded-full bg-surface-2" />}>
              {(url) => <img src={url()} alt="画师" class="w-6 h-6 rounded-full object-cover" />}
            </Show>
            <span>{painterName(l()) ?? '未知'}</span>
          </div>
        </Row>
      </Show>

      <OptRow label="种族" when={!!raceName(l())}>{raceName(l())}</OptRow>

      <OptRow label="颜色" when={colors().length > 0}>
        <div class="flex flex-wrap gap-1">
          <For each={colors()}>{(c) => (
            <span class="px-2 py-0.5 rounded-md bg-surface-2 text-[11px] text-ink">{c}</span>
          )}</For>
        </div>
      </OptRow>

      <Row label="状态">
        <div class="flex gap-1.5">
          <StatusBadge text={lock().text} color={lock().color} />
          <StatusBadge text={adopted() ? '已领养' : '未领养'} color={adopted() ? 'purple' : 'blue'} />
        </div>
      </Row>

      {/* In installment mode the plan above already labels this money 首付, so the row
          does not give the same amount a second name */}
      <OptRow label="定金" when={once() !== null && (l().earnest ?? 0) > 0}>
        {formatPrice(l().earnest ?? 0)}
      </OptRow>

      <OptRow label="创建时间" when={!!l().createTime}>{l().createTime}</OptRow>
      <OptRow label="更新时间" when={!!l().updateTime}>{l().updateTime}</OptRow>
      <OptRow label="备注" when={!!l().remark}>
        <span class="whitespace-pre-wrap">{l().remark}</span>
      </OptRow>
      <OptRow label="详细描述" when={!!l().detailDescription}>
        <span class="whitespace-pre-wrap">{l().detailDescription}</span>
      </OptRow>
    </div>
  )
}
