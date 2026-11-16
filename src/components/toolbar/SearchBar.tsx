import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons-svg'
import { searchPlaceholder, searchText, semanticOn, semanticPending, setSearchText } from '../../store'
import { warmSearch } from '../../data/searchApi'
import { AntIcon } from '../ui/AntIcon'
import { SPARK, SPARK_WORKING } from '../ui/spark'
import { makeImeGate } from '../ui/imeGate'

export function SearchBar(props: { initial?: string }) {
  const [input, setInput] = createSignal(props.initial ?? searchText())
  let el!: HTMLInputElement
  // The gate holds back the syllables that an iOS pinyin field keeps in the value, so the
  // search only receives text that the writer finished with. The box itself always shows what
  // the reader typed. The gate reads the box when its wait ends, so it never depends on
  // whether `compositionend` or the last `input` arrives first.
  const gate = makeImeGate(setSearchText, () => el.value)
  onCleanup(() => gate.dispose())

  // The pulse has to stop on a whole cycle. Stopping it in the middle makes the opacity jump
  // back to full, and every engine does that in one frame, with no transition to catch it.
  // Each cycle ends at full opacity, so the mark stops there and never in the middle. The
  // signal carries the pulse and the accent color together, and both stay in the class
  // attribute: a reactive class writes the whole attribute, so a class added by hand would
  // disappear on the next update.
  let spark!: HTMLSpanElement
  const [pulsing, setPulsing] = createSignal(false)
  createEffect(() => {
    if (semanticPending()) setPulsing(true)
  })
  const endPulse = (): void => {
    if (!semanticPending()) setPulsing(false)
  }
  onMount(() => spark.addEventListener('animationiteration', endPulse))
  onCleanup(() => spark.removeEventListener('animationiteration', endPulse))

  const onInput = (e: InputEvent) => {
    setInput((e.currentTarget as HTMLInputElement).value)
    gate.input(e.inputType, e.isComposing)
  }

  // clear immediately: reset local input + the gate's pending commit + the store's query
  const onClear = () => {
    setInput('')
    gate.reset()
    setSearchText('')
  }

  return (
    <div class="flex items-center gap-1.5 h-8 px-2 search-field rounded-lg w-full min-w-0">
      {/* The sparkle replaces the magnifier while the enhanced search is on. While a query is
          in flight it pulses in the accent color, so the working state lights up the same
          mark: no second mark appears next to it. */}
      <span
        ref={spark}
        class={`flex shrink-0 transition-colors ${pulsing() ? SPARK_WORKING : 'text-faint'}`}
      >
        <AntIcon icon={semanticOn() ? SPARK : SearchOutlined} />
      </span>
      <input
        ref={el}
        value={input()}
        onInput={onInput}
        onCompositionStart={() => gate.compositionStart()}
        onCompositionEnd={() => gate.compositionEnd()}
        onBlur={() => gate.blur()}
        onFocus={warmSearch}
        placeholder={searchPlaceholder()}
        class="bg-transparent outline-none text-sm w-full"
      />
      {/* circular clear button - only when there's input */}
      <Show when={input().length > 0}>
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
