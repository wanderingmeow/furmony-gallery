import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { tr } from "../../i18n";
import { searchPlaceholder, semanticOn } from "../../stores/semanticStore";
import { searchText, setSearchText } from "../../stores/filterStore";
import { warmSearch } from "../../data/searchApi";
import { makeImeGate } from "../ui/imeGate";
import { CHROME_REEL } from "../ui/boxes";

/** What the field's own × needs: give the text up, ending the draft and the wait with it. */
export interface SearchBarApi {
  clear: () => void;
  /** Includes typing the wait has not committed: the × mark changes with the first letter. */
  hasText: () => boolean;
}

/** The typing. The field draws the box, the mark and the ×, because they hold their place as the
 *  box grows. */
export function SearchBar(props: {
  inputRef?: (el: HTMLInputElement) => void;
  onApi?: (api: SearchBarApi) => void;
}) {
  // null means no typing of its own, so the store's query shows through
  const [draft, setDraft] = createSignal<string | null>(null);
  const shown = () => draft() ?? searchText();
  let el!: HTMLInputElement;
  // How long a pause counts as finished typing.
  const COMMIT_WAIT = 500;
  const gate = makeImeGate(() => el.value);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };
  // read when the wait ends, so compositionend and the last input can arrive in either order
  const commit = () => {
    cancel();
    const value = el.value;
    // the syllables went with the rest of the text, so the gate has nothing left to hold
    if (value === "") gate.reset();
    else if (!gate.ready()) return;
    if (value !== searchText()) setSearchText(value);
  };
  // an empty box is finished text: the list comes back in that frame, not after the wait
  const schedule = () => {
    if (el.value === "") {
      commit();
      return;
    }
    cancel();
    timer = setTimeout(commit, COMMIT_WAIT);
  };
  // a tap on 图片 a moment after typing is a question about what was just written
  onCleanup(commit);

  // a query the box did not write ends the draft and drops a commit that would overwrite it
  createEffect(
    on(searchText, () => {
      setDraft(null);
      gate.reset();
      cancel();
    }),
  );

  const onInput = (e: InputEvent) => {
    setDraft((e.currentTarget as HTMLInputElement).value);
    gate.input(e.inputType, e.isComposing);
    schedule();
  };

  // a compositionend that never arrives would leave the gate closed for the rest of the visit
  const onBlur = () => {
    gate.blur();
    schedule();
  };

  // code sets the value here, so no input event arrives: this handler clears the store too
  const onClear = () => {
    setDraft(null);
    gate.reset();
    cancel();
    setSearchText("");
  };

  // eslint-disable-next-line solid/reactivity -- the parent takes the handle once, during setup
  props.onApi?.({ clear: onClear, hasText: () => shown().length > 0 });

  // the enhanced search answers a question rather than a word, so the hint rolls questions
  /** The count the keyframes step through; a language answering another count gets the plain hint. */
  const REEL_LINES = 7;
  const examples = createMemo(() => {
    const lines = tr("search.examples")
      .split("|")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.length === REEL_LINES ? lines : null;
  });
  // nothing when the plain search is on or text is already typed
  const reelLines = createMemo(() =>
    semanticOn() && shown().length === 0 ? examples() : null,
  );

  // 16px: a smaller box makes iOS zoom the page when the field takes focus, and the zoom stays
  return (
    <>
      {/* The label holds the row's whole height, so a tap on the plate's top or bottom edge reaches
        the field instead of falling through to the card behind. The row itself is transparent to
        taps, and the input's own box is one line tall.

        A long question in a wide language does not fit the phone's field, and neither the examples
        nor a typed query may run past the circles: both end in an ellipsis, the way a placeholder
        the browser truncates does. */}
      <label class="flex min-w-0 flex-1 items-center self-stretch">
        <input
          ref={(node) => {
            el = node;
            node.value = shown();
            props.inputRef?.(node);
          }}
          value={shown()}
          onInput={onInput}
          onCompositionStart={() => gate.compositionStart()}
          onCompositionEnd={() => {
            gate.compositionEnd();
            schedule();
          }}
          onBlur={onBlur}
          onFocus={warmSearch}
          placeholder={reelLines() ? "" : searchPlaceholder()}
          aria-label={tr("search.open")}
          class="w-full min-w-0 overflow-hidden text-ellipsis bg-transparent outline-none text-base leading-6 text-ink placeholder:text-faint"
        />
      </label>
      <Show when={reelLines()}>
        {(lines) => (
          // one line tall, holding every question plus the first again where the loop restarts; its top
          // and bottom edges fade so a line dissolves instead of sliding out of a hard cut, and a
          // question wider than the field ends in an ellipsis
          <div data-reel class={CHROME_REEL} aria-hidden="true">
            <div class="search-reel-window h-6 overflow-hidden">
              <div class="animate-search-reel text-base leading-6 text-faint whitespace-nowrap">
                <For each={[...lines(), lines()[0]]}>
                  {(line) => (
                    <div
                      data-reel-line
                      class="h-6 overflow-hidden text-ellipsis"
                    >
                      {line}
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        )}
      </Show>
    </>
  );
}
