import { createSignal, Show } from 'solid-js'
import type { AdoptListing } from '../types'
import {
  colorNames, formatDiscount, formatPrice, isAdopted, isLocked, painterAvatar, painterName, raceName,
} from '../utils'
import { stableImageUrl } from '../cache'
import { StatusBadge } from './StatusBadge'

function Row(props: { label: string; children: any }) {
  return (
    <div class="grid grid-cols-[72px_1fr] gap-3">
      <span class="text-xs text-gray-500 pt-1">{props.label}</span>
      <div class="min-w-0">{props.children}</div>
    </div>
  )
}

function HeadImg(props: { url?: string }) {
  // spinner while loading; alt="" so no "head" placeholder text ever shows
  const [loading, setLoading] = createSignal(true)
  return (
    <Show when={props.url} fallback={<span class="w-15 h-15 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center"><div class="w-4 h-4 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" /></span>}>
      {(url) => (
        <div class="relative w-15 h-15 rounded-lg bg-gray-200 shrink-0 overflow-hidden">
          <Show when={loading()}>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-4 h-4 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
            </div>
          </Show>
          <img
            src={url()}
            alt=""
            class="w-15 h-15 rounded-lg object-cover border border-black/10 shadow"
            onLoad={() => setLoading(false)}
            onError={(e) => { setLoading(false); e.currentTarget.style.display = 'none' }}
          />
        </div>
      )}
    </Show>
  )
}

export function InfoTable(props: { listing: AdoptListing }) {
  const l = props.listing
  const non = () => l.nonrecurringExpense ?? 0
  const all = () => l.allcost ?? 0
  const discount = () => formatDiscount(l)
  const isDifferent = () => discount() > 0

  return (
    <div class="rounded-xl bg-white/80 border border-black/10 p-3 space-y-2.5">
      {/* header */}
      <div class="flex items-center gap-3">
        <HeadImg url={stableImageUrl(l.adoptHeadPicture)} />
        <div class="min-w-0">
          <div class="flex items-baseline gap-2">
            <h2 class="text-xl font-bold truncate">{l.adoptName ?? '未知'}</h2>
            <span class="text-sm text-gray-500 shrink-0">#{l.adoptId}</span>
          </div>
          <div class="flex items-center gap-1.5 mt-1">
            <span class="text-lg font-bold text-orange-600">{formatPrice(non())}</span>
            <Show when={isDifferent()} fallback={<span class="text-sm text-gray-400">{formatPrice(all())}</span>}>
              <span class="text-sm text-gray-400 line-through">{formatPrice(all())}</span>
              <span class="px-1.5 py-0.5 rounded bg-red-600 text-white text-[11px] font-bold">
                {discount().toFixed(1)}折
              </span>
            </Show>
          </div>
        </div>
      </div>

      {/* painter */}
      <Show when={l.harmonyPainterVo}>
        <Row label="画师">
          <div class="flex items-center gap-1.5">
            <Show when={painterAvatar(l)} fallback={<span class="w-6 h-6 rounded-full bg-gray-300" />}>
              {(url) => <img src={url()} alt="画师" class="w-6 h-6 rounded-full object-cover" />}
            </Show>
            <span>{painterName(l) ?? '未知'}</span>
          </div>
        </Row>
      </Show>

      {/* race */}
      <Show when={raceName(l)}>
        <Row label="种族">{raceName(l)}</Row>
      </Show>

      {/* colors */}
      <Show when={colorNames(l).length > 0}>
        <Row label="颜色">
          <div class="flex flex-wrap gap-1">
            {colorNames(l).map((c) => (
              <span class="px-2 py-0.5 rounded-md bg-gray-200/70 text-[11px]">{c}</span>
            ))}
          </div>
        </Row>
      </Show>

      {/* status */}
      <Row label="状态">
        <div class="flex gap-1.5">
          {/* isLock: 2=locked, 1=锁定中(未付定金), 0=unlocked — show 锁定中 for 1 */}
          <StatusBadge
            text={l.isLock === 1 ? '锁定中' : (isLocked(l) ? '已锁定' : '未锁定')}
            color={l.isLock === 1 ? 'amber' : (isLocked(l) ? 'red' : 'green')}
          />
          <StatusBadge text={isAdopted(l) ? '已领养' : '未领养'} color={isAdopted(l) ? 'purple' : 'blue'} />
        </div>
      </Row>

      {/* earnest */}
      <Row label="定金">{formatPrice(l.earnest ?? 0)}</Row>

      {/* times */}
      <Show when={l.createTime}>
        <Row label="创建时间">{l.createTime}</Row>
      </Show>
      <Show when={l.updateTime}>
        <Row label="更新时间">{l.updateTime}</Row>
      </Show>

      {/* remark */}
      <Show when={l.remark && l.remark!.length > 0}>
        <Row label="备注"><span class="whitespace-pre-wrap">{l.remark}</span></Row>
      </Show>

      {/* description */}
      <Show when={l.detailDescription && l.detailDescription!.length > 0}>
        <Row label="详细描述"><span class="whitespace-pre-wrap">{l.detailDescription}</span></Row>
      </Show>
    </div>
  )
}
