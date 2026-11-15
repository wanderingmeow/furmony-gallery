// src/components/toolbar/PictureSearch.tsx - the toolbar's picture mode.
// The status row shows one word at a time; what the service looked at is drawn on the
// picture instead of being claimed in words.
import { createEffect, onCleanup, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import { CloseOutlined, PictureOutlined } from '@ant-design/icons-svg'
import { Spinner } from '../ui/Spinner'
import { picture } from '../../store'
import { AntIcon } from '../ui/AntIcon'

/** Left of the sort buttons because using it removes them: the reader sees what is being
 *  given up. */
export function PictureToggle() {
  return (
    <button
      class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-faint
             hover:text-ink transition-colors"
      onClick={picture.open}
      aria-label="找类似的"
      title="找类似的"
    >
      <AntIcon icon={PictureOutlined} size={16} />
    </button>
  )
}

/** The reason, in the reader's words. The *action* is not here: the service sends it with the
 *  reason, and a page that guessed would offer 重试 for a picture that can never be read. */
const WHY: Record<string, string> = {
  unreadable: '这张图片读不出来',
  not_an_image: '这张图片读不出来',
  too_large: '这张图片太大了',
  embed_down: '服务没有应答',
  network: '没连上服务',
  timeout: '等得太久了',
}

const ACTION_LABEL = { pick: '换一张', retry: '重试' } as const

/** A chip rather than loose text: it has to be big enough for a thumb. */
function Chip(props: { onClick: () => void; children: JSX.Element }) {
  return (
    <button
      class="h-8 px-3 rounded-lg border border-border bg-surface font-semibold text-ink
             hover:border-black/30 dark:hover:border-white/30 transition-colors"
      onClick={props.onClick}
    >{props.children}</button>
  )
}

/** The picture that came back: the preview with the region that was searched, and one word
 *  about where the wait is. */
function AnswerRow(props: { onPick: () => void }) {
  const state = picture.state
  const why = () => WHY[picture.error()] ?? '没搜成'
  const action = picture.action
  // No action, no chip: for a reason this build has never heard of, the page offers nothing
  // rather than a 重试 that may not help.
  const actionLabel = () => {
    const next = action()
    return next === '' ? '' : ACTION_LABEL[next]
  }
  const ask = () => (action() === 'pick' ? props.onPick() : picture.search())

  return (
    <>
      {/* The frame is drawn as a percentage of the preview, so the preview keeps the
          picture's own aspect ratio: squaring it would letterbox the picture and put the
          frame on the wrong part of it. */}
      <button
        class="relative self-center shrink-0 overflow-hidden rounded-xl bg-black/5"
        onClick={props.onPick}
        aria-label="换一张"
      >
        <Show
          when={picture.preview()}
          fallback={(
            <div class="w-20 h-20 rounded-xl border border-dashed border-black/15
                        dark:border-white/20 flex items-center justify-center">
              <AntIcon icon={PictureOutlined} size={20} class="text-faint" />
            </div>
          )}
        >
          <img src={picture.preview()} alt="" class="block max-h-20 max-w-[240px]" />
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

      {/* The row stretches its children; without this the word hangs at the top of a 96px
          row next to a centred picture. */}
      <div class="self-center text-sm text-muted">
        <Show when={state() === 'searching'}>
          <span class="flex items-center gap-2">
            <Spinner size={13} /> {picture.uploading() ? '上传中' : '查找中'}
          </span>
        </Show>
        <Show when={state() === 'busy'}>稍后再试</Show>
        <Show when={state() === 'failed'}>
          {/* An unknown reason gets the sentence and no button: a button that cannot work is
              worse than none. */}
          <span class="flex items-center gap-2.5">
            {why()}
            <Show when={actionLabel()}>{(label) => <Chip onClick={ask}>{label()}</Chip>}</Show>
          </span>
        </Show>
        {/* It answered and found nothing alike: not a broken search, and 重试 would only send
            the same picture back. */}
        <Show when={state() === 'none'}>
          <span class="flex items-center gap-2.5">
            没有很像的
            <Chip onClick={props.onPick}>换一张</Chip>
          </span>
        </Show>
        {/* The wait ended with no answer: ask again rather than wipe the reader's picture
            away. */}
        <Show when={state() === 'staged'}>
          <Chip onClick={() => picture.search()}>查找</Chip>
        </Show>
      </div>
    </>
  )
}

/** The three ways to add a picture are in the tooltip: the dashed edge already shows that a
 *  picture goes here. */
function DropZone(props: { onPick: () => void }) {
  return (
    <button
      class="flex-1 min-w-0 rounded-xl border border-dashed border-black/15 dark:border-white/20
             flex flex-col items-center justify-center gap-1.5
             hover:border-black/30 dark:hover:border-white/35 transition-colors"
      onClick={props.onPick}
      title="拖入 · 粘贴 · 选图"
    >
      <AntIcon icon={PictureOutlined} size={22} class="text-faint" />
      <span class="text-sm font-semibold">是哪一只毛毛？上传就知道</span>
      <span class="text-xs text-faint">展会随拍、设计稿都行</span>
    </button>
  )
}

/** The picture is on screen before any of its bytes are, and choosing it starts the search. */
export function PictureMode() {
  let input: HTMLInputElement | undefined
  let drop: HTMLDivElement | undefined

  const take = (file: Blob | null | undefined) => {
    if (file) void picture.stage(file)
  }
  const pick = () => input?.click()

  // A pasted picture is usually one the reader cut out already: the ideal input.
  createEffect(() => {
    if (!picture.on()) return
    const onPaste = (event: ClipboardEvent) => take(event.clipboardData?.files[0])
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      if (drop) drop.classList.remove('ring-2')
      take(event.dataTransfer?.files[0])
    }
    const onOver = (event: DragEvent) => {
      event.preventDefault()
      if (drop) drop.classList.add('ring-2')
    }
    window.addEventListener('paste', onPaste)
    drop?.addEventListener('drop', onDrop)
    drop?.addEventListener('dragover', onOver)
    onCleanup(() => {
      window.removeEventListener('paste', onPaste)
      drop?.removeEventListener('drop', onDrop)
      drop?.removeEventListener('dragover', onOver)
    })
  })

  return (
    // Taller than the row it replaces: this is the one place a reader judges a picture, and a
    // 40px subject cannot be compared against the results.
    <div
      ref={drop}
      class="flex items-stretch gap-2 h-24 w-full min-w-0 rounded-lg ring-white/0 transition-[box-shadow]"
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        class="hidden"
        onChange={(event) => take((event.currentTarget.files?.[0]) ?? null)}
      />

      <Show when={picture.state() === 'empty'} fallback={<AnswerRow onPick={pick} />}>
        <DropZone onPick={pick} />
      </Show>

      {/* The way out stays at the right edge in every state: a control that moves between
          states is one readers miss. */}
      <button
        class="self-center ml-auto shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-faint
               hover:text-ink transition-colors"
        onClick={picture.close}
        aria-label="退出"
      >
        <AntIcon icon={CloseOutlined} size={11} />
      </button>
    </div>
  )
}
