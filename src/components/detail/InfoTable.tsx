import { tr, locale } from '../../i18n'
import { listingBlurb, listingName, listingPainterName, wordsPending } from '../../model/translatedText'
import { batch, createEffect, createMemo, createSignal, For, Show, type JSXElement } from 'solid-js'
import type { AdoptListing } from '../../model/types'
import { needsTranslation } from '../../model/descriptionText'
import { translateProse, translateTarget } from '../../data/translateText'
import { AntIcon } from '../ui/AntIcon'
import { TranslationOutlined } from '@ant-design/icons-svg'
import {
  MISSING_PRICE, colorDisplay, colorNames, formatPrice, isAdopted, isLocked, painterAvatar, priceParts, raceDisplay, type InstallmentPrice, type OncePrice
} from '../../model/domain'
import { sizedUrl, stableImageUrl } from '../../data/image'
import { SkelImg } from '../ui/SkelImg'
import { SkelText } from '../ui/SkelText'
import { priceMode } from '../../stores/displayStore'
import { socials } from '../../stores/socialsStore'
import { StatusBadge } from '../ui/StatusBadge'

// The first column is the head picture's width (w-15 is 60px), so values start under the title
const GRID = 'grid grid-cols-[60px_1fr] gap-3'

// 首付 and 月供 share this width, which is what lines their numbers up
const LABEL = 'w-8 shrink-0'

function Row(props: { label: string; children: JSXElement }) {
  return (
    // The 24px minimum, one line of body text, keeps a row of badges as tall as a row of words.
    // It belongs on the label: Safari keeps a grid column's minimum from the first layout, and
    // the label is the one box in the row whose height never changes.
    <div class={`${GRID} border-t border-border mt-1.5 pt-1.5`}>
      <span class="text-xs text-muted pt-1 min-h-6">{props.label}</span>
      {/* items-center keeps a 20.5px badge in the middle of the line. The grid cell lets the child
          fill the width, so the color chips can wrap. */}
      <div class="min-w-0 grid items-center">{props.children}</div>
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

/** Three lines of their own length, so the space reads as a paragraph on its way. One rule across
 *  the row would read as an empty field. A line of this paragraph is 24px tall, so 14px bars with
 *  10px between them and 5px above and below fill exactly three lines, and the row does not move
 *  when the words arrive. */
function DescSkel() {
  return (
    <div class="flex flex-col gap-2.5 py-[5px]">
      <SkelText class="h-3.5 w-full" />
      <SkelText class="h-3.5 w-[82%]" />
      <SkelText class="h-3.5 w-[38%]" />
    </div>
  )
}

type Job =
  | { kind: 'idle' }
  | { kind: 'busy'; id: number }
  | { kind: 'done'; id: number; text: string }
  | { kind: 'failed'; id: number }

/**
 * 详细描述, in the language on screen when the shelf answered in a different one.
 *
 * The shelf translates this field along with the rest of the answer, so most arrive ready to read. `needsTranslation` finds the ones that did not come that way, and the request goes out on
 * its own. The placeholder lines stay up until the answer lands, and the button is lit while the
 * translation is what the row offers, so the same tap that declines it also calls a request off.
 * A request that came back wrong leaves the shelf's own words on screen and turns the button red,
 * and the next tap sends it out again.
 */
function Description(props: { listing: () => AdoptListing }) {
  const [job, setJob] = createSignal<Job>({ kind: 'idle' })
  const [wantTranslation, setWantTranslation] = createSignal(true)
  let inFlight: AbortController | undefined

  // The detail sheet keeps this component alive while one listing's picture gives way to the next,
  // so an answer that belongs to an earlier listing counts as no answer.
  const current = createMemo<Job>(() => {
    const j = job()
    return j.kind !== 'idle' && j.id !== props.listing().adoptId ? { kind: 'idle' } : j
  })

  function stop() {
    inFlight?.abort()
    inFlight = undefined
  }

  async function run(id: number, text: string, into: string) {
    // Whatever is on its way belongs to a question the row no longer has.
    stop()
    const giveUp = new AbortController()
    inFlight = giveUp
    setJob({ kind: 'busy', id })
    try {
      const out = await translateProse(text, into, giveUp.signal)
      if (inFlight === giveUp) setJob({ kind: 'done', id, text: out })
    } catch {
      if (inFlight === giveUp) setJob({ kind: 'failed', id })
    } finally {
      if (inFlight === giveUp) inFlight = undefined
    }
  }

  // A job that is busy, done or failed is left alone, so the app sends one request per listing and
  // language. After a failure the next request goes out on the reader's tap.
  createEffect(() => {
    if (!wantTranslation() || current().kind !== 'idle') return
    const lang = locale()
    const into = translateTarget(lang)
    const text = listingBlurb(props.listing()) ?? ''
    if (into && needsTranslation(text, lang)) void run(props.listing().adoptId, text, into)
  })

  const translated = () => {
    const j = current()
    return j.kind === 'done' ? j.text : undefined
  }
  const showing = () => wantTranslation() && translated() !== undefined
  // Off means the shelf's own words, even when an answer is sitting there.
  const shownText = () => (showing() ? translated()! : listingBlurb(props.listing()))
  const offer = () =>
    translateTarget(locale()) !== undefined && needsTranslation(listingBlurb(props.listing()), locale())
  // Lit means the translation is what the row offers, on its way or already on screen. The request
  // goes out on its own, so the button starts lit and putting it out is how the reader stops it.
  const lit = () => wantTranslation() && current().kind !== 'failed'
  const label = () =>
    current().kind === 'failed'
      ? tr('detail.translateFailed')
      : lit()
        ? tr('detail.showOriginal')
        : tr('detail.translate')

  const toggle = () => {
    if (lit()) {
      stop()
      // An answer that already landed stays in the job, so the next tap shows it without a request.
      batch(() => {
        setWantTranslation(false)
        // An answer that already landed stays in the job, so the next tap shows it without a request.
        if (current().kind === 'busy') setJob({ kind: 'idle' })
      })
      return
    }
    setWantTranslation(true)
    const into = translateTarget(locale())
    const j = current()
    if (into && (j.kind === 'idle' || j.kind === 'failed')) {
      void run(props.listing().adoptId, listingBlurb(props.listing()) ?? '', into)
    }
  }
  return (
    <>
      <Show when={current().kind === 'busy'} fallback={<span class="whitespace-pre-wrap">{shownText()}</span>}>
        <DescSkel />
      </Show>
      <Show when={offer()}>
        {/* A row of its own under the text. Pinned to the corner it would sit on the last line. The
            note takes the left end, so the row still holds one button. */}
        <div class="mt-1.5 flex items-center justify-end gap-2">
          <Show when={showing()}>
            <span class="mr-auto text-[11px] text-faint">{tr('detail.translatedNote')}</span>
          </Show>
          <button
            type="button"
            onClick={toggle}
            title={label()}
            aria-label={label()}
            class={[
              'grid h-7 w-7 place-items-center rounded-lg border transition-colors',
              // `ink` flips with the theme, so an ink wash darkens the button in light mode and
              // lights it in dark mode: one hover state for both.
              current().kind === 'failed'
                ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900'
                : lit()
                  ? 'border-accent/40 bg-accent/15 text-accent-soft hover:bg-accent/25 active:bg-accent/30'
                  : 'border-border bg-surface-2 text-ink-faint hover:border-ink/30 hover:bg-ink/10 active:bg-ink/20',
            ].join(' ')}
          >
            <AntIcon icon={TranslationOutlined} size={15} />
          </button>
        </div>
      </Show>
    </>
  )
}

function HeadImg(props: { url?: string }) {
  const box = 'w-15 h-15 rounded-lg shrink-0'
  return (
    <Show
      when={props.url}
      fallback={<span class={`bg-surface-2 ${box}`} />}
    >
      {(url) => <SkelImg url={url()} box={box} imgClass="rounded-lg border-2 border-border shadow" />}
    </Show>
  )
}

function OncePriceLine(props: { parts: () => OncePrice }) {
  const p = props.parts
  return (
    <div class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
      <span class="text-lg font-bold text-accent-ink">{formatPrice(p().main)}</span>
      <Show when={p().secondary}>{(total) => (
        <span class="text-sm text-faint line-through">{formatPrice(total())}</span>
      )}</Show>
      <Show when={p().discount > 0}>
        <span class="px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[11px] font-bold">
          {tr('info.discount', p().discount)}
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
          <span class={`${LABEL} text-sm font-medium text-accent-ink relative -top-[0.1em]`}>{tr('info.downPayment')}</span>
          <span class="text-xl font-bold text-accent-ink tabular-nums">{formatPrice(down())}</span>
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
        <Show when={p().total}>{(total) => <span>{tr('info.total', formatPrice(total()))}</span>}</Show>
      </div>
      {/* A listing with no price has neither, so the rows above would sit empty. */}
      <Show when={!p().down && !p().main}>
        <span class="text-lg font-bold text-accent-ink tabular-nums">{MISSING_PRICE}</span>
      </Show>
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
    l().isLock === 1 ? { text: tr('detail.lockedNow'), color: 'amber' as const }
      : isLocked(l()) ? { text: tr('detail.locked'), color: 'red' as const }
        : { text: tr('detail.unlocked'), color: 'green' as const })
  const adopted = createMemo(() => isAdopted(l()))

  return (
    <div class="rounded-xl bg-surface border border-border p-3">
      <div class={`${GRID} items-start`}>
        <HeadImg url={sizedUrl(stableImageUrl(l().adoptHeadPicture), 'badge')} />
        <div class="min-w-0">
          <div class="flex items-baseline gap-2">
            <h2 class="text-xl font-bold truncate">
              {wordsPending() ? <SkelText class="h-6 w-28" /> : listingName(l()) ?? tr('common.unknown')}
            </h2>
            <span class="text-sm text-muted shrink-0">#{l().adoptId}</span>
          </div>
          <Show when={plan()}>{(p) => <InstallmentPlan parts={p} />}</Show>
          <Show when={once()}>{(p) => <OncePriceLine parts={p} />}</Show>
        </div>
      </div>

      {/* We load socials per detail page, so 主人 shows only when that table has this id */}
      <OptRow label={tr('detail.owner')} when={!!owner()}>{owner()}</OptRow>

      <Show when={l().harmonyPainterVo}>
        <Row label={tr('detail.painter')}>
          <div class="flex items-center gap-1.5">
            <Show when={painterAvatar(l())} fallback={<span class="w-6 h-6 rounded-full bg-surface-2" />}>
              {(url) => <img src={url()} alt={tr('detail.painter')} class="w-6 h-6 rounded-full object-cover" />}
            </Show>
            {/* The painter is one of the fields the shelf answers, so the name the row carries
                belongs to the language before the reader's pick. */}
            {wordsPending() ? <SkelText class="h-4 w-20" /> : <span>{listingPainterName(l()) ?? tr('common.unknown')}</span>}
          </div>
        </Row>
      </Show>

      <OptRow label={tr('detail.race')} when={!!raceDisplay(l())}>{raceDisplay(l())}</OptRow>

      <OptRow label={tr('detail.color')} when={colors().length > 0}>
        <div class="flex flex-wrap gap-1">
          <For each={colors()}>{(c) => (
            <span class="px-2 py-0.5 rounded-md bg-surface-2 text-[11px] text-ink">{colorDisplay(c)}</span>
          )}</For>
        </div>
      </OptRow>

      <Row label={tr('detail.status')}>
        <div class="flex gap-1.5">
          <StatusBadge text={lock().text} color={lock().color} />
          <StatusBadge text={adopted() ? tr('detail.adopted') : tr('detail.unadopted')} color={adopted() ? 'purple' : 'blue'} />
        </div>
      </Row>

      {/* In installment mode the plan above already labels this money 首付, so the row
          does not give the same amount a second name */}
      <OptRow label={tr('detail.deposit')} when={once() !== null && (l().earnest ?? 0) > 0}>
        {formatPrice(l().earnest ?? 0)}
      </OptRow>

      <OptRow label={tr('detail.created')} when={!!l().createTime}>{l().createTime}</OptRow>
      <OptRow label={tr('detail.updated')} when={!!l().updateTime}>{l().updateTime}</OptRow>
      <OptRow label={tr('detail.note')} when={!!l().remark}>
        <span class="whitespace-pre-wrap">{l().remark}</span>
      </OptRow>
      <OptRow label={tr('detail.description')} when={wordsPending() || !!listingBlurb(l())}>
        <Show when={!wordsPending()} fallback={<DescSkel />}>
          <Description listing={l} />
        </Show>
      </OptRow>
    </div>
  )
}
