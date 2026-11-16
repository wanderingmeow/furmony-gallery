import { createSignal, onCleanup, Show } from 'solid-js'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons-svg'
import { Spinner } from '../ui/Spinner'
import { searchPlaceholder, searchText, semanticPending, setSearchText } from '../../store'
import { warmSearch } from '../../data/searchApi'
import { AntIcon } from '../ui/AntIcon'
import { makeImeGate } from '../ui/imeGate'

export function SearchBar(props: { initial?: string }) {
  const [input, setInput] = createSignal(props.initial ?? searchText())
  // The gate holds back the syllables that an iOS pinyin field keeps in the value, so the
  // search only receives text the writer finished with. The box itself always shows what
  // the reader typed.
  const gate = makeImeGate(setSearchText)
  onCleanup(() => gate.dispose())

  const onInput = (e: InputEvent) => {
    const value = (e.currentTarget as HTMLInputElement).value
    setInput(value)
    gate.input(value, e.inputType, e.isComposing)
  }

  // clear immediately: reset local input + the gate's pending commit + the store's query
  const onClear = () => {
    setInput('')
    gate.reset()
    setSearchText('')
  }

  return (
    <div class="flex items-center gap-1.5 h-8 px-2 search-field rounded-lg w-full min-w-0">
      <AntIcon icon={SearchOutlined} class="text-faint shrink-0" />
      <input
        value={input()}
        onInput={onInput}
        onCompositionStart={() => gate.compositionStart()}
        onCompositionEnd={(e) => gate.compositionEnd((e.currentTarget as HTMLInputElement).value)}
        onBlur={(e) => gate.blur(e.currentTarget.value)}
        onFocus={warmSearch}
        placeholder={searchPlaceholder()}
        class="bg-transparent outline-none text-sm w-full"
      />
      {/* The Beta search answers in ~150ms, which is fast enough to feel instant and
          slow enough to notice when several queries are in flight. */}
      <Show when={semanticPending()}>
        <Spinner class="text-faint" size={12} />
      </Show>
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
