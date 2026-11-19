import { tr } from '../../i18n'
import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons-svg'
import { searchPlaceholder, semanticOn, semanticPending } from '../../stores/semanticStore'
import { searchText, setSearchText } from '../../stores/filterStore'
import { warmSearch } from '../../data/searchApi'
import { AntIcon } from '../ui/AntIcon'
import { SPARK, SparkMark } from '../ui/spark'
import { makeImeGate } from '../ui/imeGate'

export function SearchBar() {
  // What the reader typed, before the wait ends. null means the box holds no typing of its own, so
  // it shows the store's query, which a reload can restore while the box is already on screen.
  const [draft, setDraft] = createSignal<string | null>(null)
  const shown = () => draft() ?? searchText()
  let el!: HTMLInputElement
  // How long a pause counts as finished typing.
  const COMMIT_WAIT = 500
  const gate = makeImeGate(() => el.value)
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }
  // The box is read when the wait ends, so the order of `compositionend` and the last `input` does
  // not matter.
  const commit = () => {
    cancel()
    const value = el.value
    // The gate may still be open from a composition, but the syllables went with the rest of the
    // text, so there is nothing left for it to hold.
    if (value === '') gate.reset()
    else if (!gate.ready()) return
    if (value !== searchText()) setSearchText(value)
  }
  // Clearing the whole box at once arrives as one `input` event over an empty value: select all
  // and delete, cut, or the key that erases the line. An empty box is finished text, so the list
  // comes back in that frame rather than after the wait.
  const schedule = () => {
    if (el.value === '') {
      commit()
      return
    }
    cancel()
    timer = setTimeout(commit, COMMIT_WAIT)
  }
  // Leaving the screen still sends the box's last text to the store: a tap on 图片 a moment after
  // typing is a question about what the reader just wrote.
  onCleanup(commit)

  // A query the box did not write ends the draft. It also drops a commit that is still waiting,
  // which would write the box's older text back over this query.
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

  // A `compositionend` that never arrives would leave the gate closed. Blur opens it again, so text
  // the reader finished with still becomes a query.
  const onBlur = () => {
    gate.blur()
    schedule()
  }

  // Code sets the value here, so no input event arrives. This handler has to end the draft, drop
  // the commit that is waiting, and clear the store's query itself.
  const onClear = () => {
    setDraft(null)
    gate.reset()
    cancel()
    setSearchText('')
  }

  return (
    <div class="flex items-center gap-1.5 h-8 px-2 search-field rounded-lg w-full min-w-0">
      {/* The sparkle replaces the magnifier while the enhanced search is on. During a query it
          pulses in the accent color, so the pulse shows the wait on the mark that is already there,
          and no second mark sits beside it. */}
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
          aria-label={tr('search.clear')}
        >
          <AntIcon icon={CloseOutlined} size={10} />
        </button>
      </Show>
    </div>
  )
}
