import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons-svg'
import { searchPlaceholder, searchText, semanticOn, semanticPending, setSearchText } from '../../store'
import { warmSearch } from '../../data/searchApi'
import { AntIcon } from '../ui/AntIcon'
import { SPARK, SparkMark } from '../ui/spark'
import { makeImeGate } from '../ui/imeGate'

export function SearchBar() {
  // The box shows what the reader typed. Otherwise it shows the store's query, which a reload
  // can restore while this box is already on screen.
  const [draft, setDraft] = createSignal<string | null>(null)
  const shown = () => draft() ?? searchText()
  let el!: HTMLInputElement
  // How long a pause counts as finished typing. The gate only says whether the box holds a
  // finished sentence, and the wait belongs to the field. A field that leaves the screen hands its
  // text to the store on the way out, so tapping 图片 a moment after typing keeps the sentence.
  const COMMIT_WAIT = 500
  const gate = makeImeGate(() => el.value)
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }
  // The box is read when the wait ends, so the order of `compositionend` and the last `input`
  // stops mattering. A box that still holds syllables is not a question, and a box that repeats
  // the query already in the store asks for nothing.
  const flush = () => {
    const wasWaiting = timer !== null
    cancel()
    if (wasWaiting && gate.ready() && el.value !== searchText()) setSearchText(el.value)
  }
  const schedule = () => {
    cancel()
    timer = setTimeout(flush, COMMIT_WAIT)
  }
  onCleanup(flush)

  // A query that the box did not write ends the draft, and ends the commit still waiting, so that
  // commit cannot land on top of the query a moment later.
  createEffect(on(searchText, () => {
    setDraft(null)
    gate.reset()
    cancel()
  }))

  const onInput = (e: InputEvent) => {
    setDraft((e.currentTarget as HTMLInputElement).value)
    gate.input(e.inputType, e.isComposing)
    schedule()
  }

  // A `compositionend` that never arrives leaves the gate holding the box. Blur is the way out, so
  // the text that the reader finished with still reaches the store.
  const onBlur = () => {
    gate.blur()
    schedule()
  }

  // Code changes the value here, so no input event arrives, and this handler clears the three
  // paths itself: the draft, the commit still waiting, and the store's query.
  const onClear = () => {
    setDraft(null)
    gate.reset()
    cancel()
    setSearchText('')
  }

  return (
    <div class="flex items-center gap-1.5 h-8 px-2 search-field rounded-lg w-full min-w-0">
      {/* The sparkle replaces the magnifier when the enhanced search is on. During a query it
          pulses in the accent color, so the working state lights up the same mark, with no
          second mark beside it. */}
      <SparkMark
        class="shrink-0 text-faint"
        working={semanticPending}
        icon={() => (semanticOn() ? SPARK : SearchOutlined)}
      />
      <input
        ref={el}
        value={shown()}
        onInput={onInput}
        onCompositionStart={() => gate.compositionStart()}
        onCompositionEnd={() => { gate.compositionEnd(); schedule() }}
        onBlur={onBlur}
        onFocus={warmSearch}
        placeholder={searchPlaceholder()}
        class="bg-transparent outline-none text-sm w-full"
      />
      <Show when={shown().length > 0}>
        <button
          class="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-faint hover:text-ink transition-colors"
          onClick={onClear}
          aria-label="清除搜索"
        >
          <AntIcon icon={CloseOutlined} size={10} />
        </button>
      </Show>
    </div>
  )
}
