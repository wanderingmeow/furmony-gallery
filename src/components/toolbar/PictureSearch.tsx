// src/components/toolbar/PictureSearch.tsx - the toolbar's picture mode: one word at a time in
// the toolbar row, and the picture that was searched beside it.
import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import { PictureOutlined } from '@ant-design/icons-svg'
import { picture, type PictureState } from '../../stores/semanticStore'
import { warmSearch, type PictureError } from '../../data/searchApi'
import { AntIcon } from '../ui/AntIcon'
import { SparkMark } from '../ui/spark'

/** Left of the sort buttons because using it removes them: the reader sees what is being
 *  given up. */
export function PictureToggle() {
  return (
    // The row grows when the mode opens, and a control that moves is one that readers miss, so
    // the circle keeps the top edge it had beside the field.
    <button
      class="self-start shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
             transition-colors"
      classList={{ 'text-accent': picture.on(), 'text-faint hover:text-ink': !picture.on() }}
      aria-label="找类似的"
      aria-pressed={picture.on()}
      title="找类似的"
      onClick={() => {
        // The reader is about to go looking for a file, which is the longest pause in this
        // path: the trip to the service gets paid while that search is happening.
        warmSearch()
        picture.on() ? picture.close() : picture.open()
      }}
    >
      <AntIcon icon={PictureOutlined} size={16} />
    </button>
  )
}

const NO_WORD = '没搜成'

/** The reason, in the reader's words. The *action* is not here: the service sends it with the
 *  reason, and a page that guessed would offer 重试 for a picture that can never be read.
 *  Typed against `PictureError` so a new reason from the encode path cannot ship without its
 *  sentence; a word from a newer service still falls through to the line below. */
const WHY: Record<PictureError, string> = {
  unreadable: '这张图片读不出来',
  not_an_image: '这张图片读不出来',
  // The file is fine; this browser has no HEVC decoder (Windows Chrome needs the HEVC
  // extension). 读不出来 would send the reader to another app for nothing.
  noHevc: '这个浏览器解不了 HEIC 照片',
  too_large: '这张图片太大了',
  embed_down: '服务没有应答',
  network: '没连上服务',
  timeout: '等得太久了',
  // The body arrived and was not a result at all. Our own word, so it gets its own line
  // rather than the `??` below, which is for words a newer service invents.
  unknown: NO_WORD,
}

const why = () => WHY[picture.error() as PictureError] ?? NO_WORD

const ACTION_LABEL = { pick: '换一张', retry: '重试' } as const

/** A chip rather than loose text: it has to be big enough for a thumb. */
function Chip(props: { onClick: () => void; children: JSX.Element }) {
  return (
    <button
      class="h-8 px-3 shrink-0 whitespace-nowrap rounded-lg border border-border bg-surface
             font-semibold text-ink
             hover:border-black/30 dark:hover:border-white/30 transition-colors"
      onClick={props.onClick}
    >{props.children}</button>
  )
}

// This is the one place a reader compares a picture against the results, so the row has a second
// height for a pointer. ROW is the height the toolbar had before picture mode.

const ROW = 72
const ROW_TALL = 128
const SLOT = 128
const SLOT_TALL = 200
const IMG_TALL = 112

/** Only the answer grows: 没有很像的 and a failure both show a button under the word, and a row
 *  that changes height moves that button out from under the thumb. The whole banner is the
 *  trigger, so the reader does not have to aim the pointer at this row. */
const growsOnHover = () => picture.state() === 'done'

/** The picture stands in a slot of its own, so the word beside it starts in the same place for
 *  every picture, and for the same picture as it loads. A word that slides right when the bytes
 *  arrive reads as a new line of text. */
function PreviewWithBox(props: { onClick: () => void }) {
  return (
    <div
      class="self-center shrink-0 flex items-center justify-center max-w-1/2 w-[var(--pic-slot)]
             transition-[width]"
      classList={{
        'pointer-fine:group-hover:w-[var(--pic-slot-tall)]': growsOnHover(),
      }}
    >
      <button
        class="relative block overflow-hidden rounded-lg bg-black/5"
        onClick={props.onClick}
        aria-label={ACTION_LABEL.pick}
      >
        <Show
          when={picture.preview()}
          fallback={(
            <div class="w-[var(--pic-row)] h-[var(--pic-row)] rounded-lg border border-dashed border-black/15
                        dark:border-white/20 flex items-center justify-center">
              <AntIcon icon={PictureOutlined} size={20} class="text-faint" />
            </div>
          )}
        >
          <img
            src={picture.preview()}
            alt=""
            class="block max-h-[var(--pic-row)] max-w-full transition-[max-height]"
            classList={{
              'pointer-fine:group-hover:max-h-[var(--pic-img-tall)]': growsOnHover(),
            }}
          />
          {/* Where the service looked, drawn back over the picture: any sentence about what a
            model attended to would just be a claim. */}
          <Show when={picture.box()}>
            {(b) => (
              <div
                class="absolute pointer-events-none"
                style={{
                  left: `${b()[0] * 100}%`,
                  top: `${b()[1] * 100}%`,
                  width: `${b()[2] * 100}%`,
                  height: `${b()[3] * 100}%`,
                  border: '1.5px solid #fff',
                  'box-shadow': '0 0 0 1px rgba(0,0,0,.45)',
                }}
              />
            )}
          </Show>
        </Show>
      </button>
    </div>
  )
}

// `spark` sits with its word so that the compiler checks both when someone adds a state. A wait
// with no spark looks like a page that stalled. `empty` and `staged` have neither: the picture is
// up and no wait is running.
function stateLines(onPick: () => void): Record<PictureState, { word: () => JSX.Element; spark?: true }> {
  // No action, no chip: for a reason this build has never heard of, a 重试 that may not help is
  // worse than no button.
  const actionLabel = () => {
    const next = picture.action()
    return next === '' ? '' : ACTION_LABEL[next]
  }
  const ask = () => (picture.action() === 'pick' ? onPick() : picture.search())

  return {
    empty: { word: () => <></> },
    staged: { word: () => <></> },
    // The reader's own device opens and shrinks the picture. No request exists yet, so
    // 上传中 and 查找中 would both be wrong: the word is 加载中.
    preparing: { spark: true, word: () => <>加载中</> },
    searching: { spark: true, word: () => <>{picture.uploading() ? '上传中' : '查找中'}</> },
    busy: { word: () => <>稍后再试</> },
    // The button sits below the sentence. A button beside it would shift between lines as the
    // sentence changed length, and a control that moves is harder to hit than one extra row.
    failed: {
      word: () => (
        <span class="flex flex-col items-start gap-2">
          <span>{why()}</span>
          <Show when={actionLabel()}>{(label) => <Chip onClick={ask}>{label()}</Chip>}</Show>
        </span>
      ),
    },
    // The list under the toolbar now follows the picture, and the word says what changed its
    // order.
    done: { word: () => <span class="font-semibold text-ink">视觉匹配结果</span> },
    // The service found nothing alike, and 重试 would only send the same picture back.
    none: {
      word: () => (
        <span class="flex flex-col items-start gap-2">
          <span>没有很像的</span>
          <Chip onClick={onPick}>{ACTION_LABEL.pick}</Chip>
        </span>
      ),
    },
  }
}

/** A file held over the row turns the dashed edge solid, because that edge is already the only
 *  frame in this row. */
function DropZone(props: { onPick: () => void; dragging: () => boolean }) {
  return (
    <button
      class="flex-1 min-w-0 rounded-lg border-black/15 dark:border-white/20
             flex flex-col items-center justify-center gap-2.5
             hover:border-black/30 dark:hover:border-white/35 transition-colors"
      classList={{
        'border border-dashed': !props.dragging(),
        'border-2 border-solid bg-black/5 dark:bg-white/10': props.dragging(),
      }}
      onClick={props.onPick}
      title="可以拖入图片，粘贴图片，或者点击选择"
    >
      <AntIcon icon={PictureOutlined} size={30} class="text-faint" />
      <span class="flex flex-col items-center gap-0.5">
        <span class="text-base font-semibold">是哪一只毛毛？上传就知道</span>
        <span class="text-xs text-faint">展会随拍、设计稿都行</span>
      </span>
    </button>
  )
}

// The paste listener sits on the window: the reader copies before this row has a thing to click.
function watchPictureArrival(
  drop: () => HTMLElement | undefined,
  take: (file: Blob) => void,
) {
  const [dragging, setDragging] = createSignal(false)

  createEffect(on(picture.on, (shown) => {
    if (!shown) return
    const zone = drop()
    const hand = (file: File | undefined) => {
      if (file) take(file)
    }
    // A pasted picture is usually one that the reader has cut out: the ideal input.
    const onPaste = (event: ClipboardEvent) => hand(event.clipboardData?.files[0])
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      setDragging(false)
      hand(event.dataTransfer?.files[0])
    }
    const onOver = (event: DragEvent) => {
      event.preventDefault()
      setDragging(true)
    }
    // Without this the edge stays solid after a drag that never lands.
    const onLeave = () => setDragging(false)
    window.addEventListener('paste', onPaste)
    zone?.addEventListener('drop', onDrop)
    zone?.addEventListener('dragover', onOver)
    zone?.addEventListener('dragleave', onLeave)
    onCleanup(() => {
      window.removeEventListener('paste', onPaste)
      zone?.removeEventListener('drop', onDrop)
      zone?.removeEventListener('dragover', onOver)
      zone?.removeEventListener('dragleave', onLeave)
    })
  }))

  return { dragging }
}

/** The picture is on screen before any of its bytes are, and choosing it starts the search. */
export function PictureMode() {
  let input: HTMLInputElement | undefined
  let drop: HTMLDivElement | undefined
  const pick = () => input?.click()
  const { dragging } = watchPictureArrival(() => drop, (file) => { void picture.stage(file) })
  const empty = () => picture.state() === 'empty'
  const line = () => stateLines(pick)[picture.state()]

  return (
    <div
      ref={drop}
      class="flex items-stretch gap-2 w-full min-w-0 transition-[height]"
      style={{
        '--pic-row': `${ROW}px`,
        '--pic-row-tall': `${ROW_TALL}px`,
        '--pic-slot': `${SLOT}px`,
        '--pic-slot-tall': `${SLOT_TALL}px`,
        '--pic-img-tall': `${IMG_TALL}px`,
      }}
      classList={{
        'h-[var(--pic-row-tall)]': empty(),
        'h-[var(--pic-row)]': !empty(),
        'pointer-fine:group-hover:h-[var(--pic-row-tall)]': growsOnHover(),
      }}
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        class="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) void picture.stage(file)
        }}
      />

      <Show
        when={empty()}
        fallback={(
          <>
            <PreviewWithBox onClick={pick} />
            {/* Its own item in the row, so the one gap on the row sits on both sides of the spark. */}
            <Show when={line().spark}><SparkMark class="self-center" size={16} working /></Show>
            {/* The row stretches its children; without this the word hangs at the top of a
                tall row next to a centerd picture. */}
            <div class="self-center min-w-0 text-sm text-muted">{line().word()}</div>
          </>
        )}
      >
        <DropZone onPick={pick} dragging={dragging} />
      </Show>
    </div>
  )
}
