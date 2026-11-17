import { createEffect, createSignal, on, onCleanup, onMount, Show } from 'solid-js'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons-svg'
import { searchPlaceholder, searchText, semanticOn, semanticPending, setSearchText } from '../../store'
import { warmSearch } from '../../data/searchApi'
import { AntIcon } from '../ui/AntIcon'
import { SPARK, SPARK_WORKING } from '../ui/spark'
import { makeImeGate } from '../ui/imeGate'

export function SearchBar() {
  // The box shows what the reader typed. Otherwise it shows the store's query, which a reload
  // can restore while this box is already on screen.
  const [draft, setDraft] = createSignal<string | null>(null)
  const shown = () => draft() ?? searchText()
  let el!: HTMLInputElement
  // The gate reads the box at the end of its wait, so the order of `compositionend` and the
  // last `input` stops mattering.
  const gate = makeImeGate(setSearchText, () => el.value)
  onCleanup(() => gate.dispose())

  let spark!: HTMLSpanElement
  const [pulsing, setPulsing] = createSignal(false)
  createEffect(() => {
    if (semanticPending()) setPulsing(true)
  })
  // Stopping partway leaves the accent at whatever brightness it had reached, and no transition
  // softens that jump. Every cycle ends on the resting grey, so the code drops the class at that
  // moment and the mark rests where it sits when idle.
  const endPulse = (): void => {
    if (!semanticPending()) setPulsing(false)
  }
  onMount(() => spark.addEventListener('animationiteration', endPulse))
  onCleanup(() => spark.removeEventListener('animationiteration', endPulse))

  // A query that the box did not write ends the draft, and ends any commit that the gate still
  // holds back, so that commit cannot land on top of the query a moment later.
  createEffect(on(searchText, () => {
    setDraft(null)
    gate.reset()
  }))

  const onInput = (e: InputEvent) => {
    setDraft((e.currentTarget as HTMLInputElement).value)
    gate.input(e.inputType, e.isComposing)
  }

  // Code changes the value here, so no input event arrives, and this handler clears the three
  // paths itself: the draft, the commit that the gate holds back, and the store's query.
  const onClear = () => {
    setDraft(null)
    gate.reset()
    setSearchText('')
  }

  return (
    <div class="flex items-center gap-1.5 h-8 px-2 search-field rounded-lg w-full min-w-0">
      {/* The sparkle replaces the magnifier when the enhanced search is on. During a query it
          pulses in the accent color, so the working state lights up the same mark, with no
          second mark beside it. */}
      <span
        ref={spark}
        class={`flex shrink-0 text-faint ${pulsing() ? SPARK_WORKING : ''}`}
      >
        <AntIcon icon={semanticOn() ? SPARK : SearchOutlined} />
      </span>
      <input
        ref={el}
        value={shown()}
        onInput={onInput}
        onCompositionStart={() => gate.compositionStart()}
        onCompositionEnd={() => gate.compositionEnd()}
        onBlur={() => gate.blur()}
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
