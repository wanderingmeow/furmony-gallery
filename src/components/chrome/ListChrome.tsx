import { createEffect, createSignal, onCleanup, Show, type JSX } from 'solid-js'
import { CloseOutlined, PictureOutlined, SearchOutlined } from '@ant-design/icons-svg'
import { tr } from '../../i18n'
import { searchText } from '../../stores/filterStore'
import { picture, semanticOn, semanticPending } from '../../stores/semanticStore'
import { warmSearch } from '../../data/searchApi'
import { AntIcon } from '../ui/AntIcon'
import { SparkMark } from '../ui/spark'
import { BackspaceIcon } from '../ui/BackspaceIcon'
import {
  CHROME_ACTS, CHROME_ACTS_HOLD, CHROME_BAND, CHROME_BAR_BOX, CHROME_CORNER, CHROME_FIELD, CHROME_HIT,
  CHROME_PLATE_BOX, CHROME_PLATE_REST, CHROME_TEXT_IN, CHROME_TEXT_OUT, CHROME_TAB_BAR, CHROME_LINE,
  CHROME_PILL, CHROME_PLATE,
  CHROME_ROW, CHROME_ROW_OUT, CHROME_ROW_PICTURE, CHROME_ROW_TEXT, PLATE_OPEN_R, PLATE_REST_R,
} from '../ui/boxes'
import { TabPill } from './TabPill'
import { CornerActions } from '../fab/CornerActions'
import { SearchBar, type SearchBarApi } from './SearchBar'
import { PictureMode } from './PictureSearch'
import {
  CHROME_WIDE, FIELD_DROP, FIELD_LEAD, FIELD_PICTURE, FIELD_REST, FIELD_TEXT, FIELD_WIDE, PLATE_AIR,
} from '../../draw/layout'
import { watchViewport } from '../ui/viewport'
import { holdPage } from '../../draw/pageHold'

/** The entry a box the user opened leaves on the stack. Every way back arrives as one popstate,
 *  and only the entry's own state says whether the pop answered something stacked above it. */
type Stand = { searchStand?: boolean }
const standing = () => !!(history.state as Stand | null)?.searchStand

/** A circle on the field's right edge: 40px, because these stand inside the box and the corner's
 *  pair stands outside it. */
function Act(props: { label: string; pressed?: () => boolean; onClick: () => void; children: JSX.Element }) {
  return (
    <button
      class="w-10 h-10 shrink-0 grid place-items-center rounded-full
             transition-[background-color,color,transform] duration-150 active:scale-[0.92]
             motion-reduce:transition-none"
      classList={{
        'text-ink active:bg-black/10 dark:active:bg-white/10': !props.pressed?.(),
        'bg-accent text-white active:bg-accent-ink': !!props.pressed?.(),
      }}
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed === undefined ? undefined : props.pressed()}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

/** The field holds one search at a time: a picture replaces the text row and takes the tall box,
 *  and the pill leaves the bottom edge because the box is the way out of a picture.
 *
 *  The field grows over the cards rather than pushing them down, so nothing here moves the page. */
export function ListChrome() {
  const [held, setHeld] = createSignal(false)
  // The press belongs to the gesture that asked the box open, so it is settled when the finger goes
  // down: a press made while the box is open is on its way out and must not grow the circle.
  const [press, setPress] = createSignal(false)
  // the box hands its controls over, so the × holds its place while the box changes shape
  const [bar, setBar] = createSignal<SearchBarApi>()
  let input!: HTMLInputElement

  // a restored query or a staged picture is something the user should see what is answering
  const isOpen = () => held() || searchText().length > 0 || picture.on()
  // the typing itself, which runs ahead of the query the wait commits
  const typed = () => bar()?.hasText() ?? false
  const height = () => !isOpen()
    ? FIELD_REST
    // the empty drop zone is the tall one; a staged picture and an unreadable one share one row
    : picture.on()
      ? (picture.state() === 'empty' ? FIELD_DROP : FIELD_PICTURE)
      : FIELD_TEXT

  // the corner and the placeholder band are separate fixed elements, so they read the field's
  // numbers off the root: --field-h is the box, --field-text the line the circles stand centred on
  createEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--field-h', `${height()}px`)
    root.style.setProperty('--field-text', `${FIELD_TEXT}px`)
    root.style.setProperty('--field-lead', `${isOpen() ? FIELD_LEAD : FIELD_REST}px`)
  })
  onCleanup(() => {
    const root = document.documentElement
    for (const name of ['--field-h', '--field-text', '--field-lead']) root.style.removeProperty(name)
  })

  // How far the plate stands back from the field's right edge: the corner's circle and 8px on a
  // phone, a fixed measure on an edge wide enough for one. The rows inset from the same number.
  const { frameW } = watchViewport()
  const plateAir = () => !isOpen()
    ? '0px'
    : frameW() >= CHROME_WIDE ? `calc(100% - ${FIELD_WIDE}px)` : PLATE_AIR

  const open = () => {
    warmSearch()
    setHeld(true)
    if (!standing()) history.pushState({ ...history.state, searchStand: true }, '')
    // Safari raises a keyboard only for a focus it is asked for inside the tap, so this cannot wait
    // for the box to finish growing. A query restored on load opens the box without this call.
    input.focus({ preventScroll: true })
    // a second ask next frame is outside the gesture: the caret arrives, the keyboard does not
    if (document.activeElement !== input) {
      requestAnimationFrame(() => input.focus({ preventScroll: true }))
    }
  }
  const close = () => {
    bar()?.clear()
    setHeld(false)
    // the blur and the history step are both scroll requests: draw/pageHold.ts keeps this number
    const at = window.scrollY
    input.blur()
    leaveStand()
    holdPage(at)
  }

  const leaveStand = () => {
    if (!standing()) return
    history.back()
  }

  // Back, however it was made
  const onPop = () => {
    if (!standing() && isOpen()) close()
  }
  window.addEventListener('popstate', onPop)
  onCleanup(() => window.removeEventListener('popstate', onPop))
  // a draft an input method is holding takes Escape first, so that one stays with the input method
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !e.isComposing && document.activeElement === input) close()
  }
  window.addEventListener('keydown', onKey)
  onCleanup(() => window.removeEventListener('keydown', onKey))

  const togglePicture = () => {
    // the file search is the longest pause in this path, so the service trip is paid inside it
    warmSearch()
    picture.on() ? picture.close() : picture.open()
  }
  return (
    <>
      {/* Every part of the band is drawn with utility classes, so these names are what a check that
          measures the band reads. The two attributes say which shape the band is in. */}
      <div class={CHROME_BAND} data-chrome="band" data-open={isOpen()} data-picture={picture.on()}>
        <div class={CHROME_BAR_BOX}>
          <div class={CHROME_LINE}>
            <div class={CHROME_CORNER} data-chrome="corner">
              <CornerActions />
            </div>
          </div>

          <div
            class={CHROME_FIELD}
            data-chrome="field"
            role="search"
            style={{
              // one circle: the picture is up, or the enhanced search is off
              '--chrome-acts': picture.on() || !semanticOn() ? '56px' : '100px',
              '--plate-r': isOpen() ? PLATE_OPEN_R : PLATE_REST_R,
              '--plate-air': plateAir(),
            }}
          >
            <div
              data-chrome="plate"
              class={`${CHROME_PLATE} ${isOpen() ? CHROME_PLATE_BOX : CHROME_PLATE_REST}`}
              style={{ right: isOpen() ? 'var(--plate-air)' : 'calc(100% - var(--fab-size))' }}
              onClick={() => isOpen() && input.focus({ preventScroll: true })}
            >
              {/* The two circles stay where they stood while the box grew around them. The × is
                  whichever of the two the box needs: a field with text gives the text up, an empty
                  one gives the box up. A picture has its own way out, the lit circle, so the × stands
                  down while one is staged and keeps its place in the row: a circle that left the row
                  would drag the picture circle along with it. */}
              <div class={CHROME_ACTS_HOLD}>
                <div
                  data-chrome="acts"
                  class={CHROME_ACTS}
                  classList={{ 'invisible opacity-0': !isOpen() }}
                >
                  <div classList={{ invisible: picture.on() }}>
                    <Act
                      label={typed() ? tr('search.clear') : tr('search.close')}
                      onClick={() => {
                        if (!typed()) return close()
                        // ⌫ gives the text up, not the box: the caret stays in the field
                        bar()?.clear()
                        setHeld(true)
                        input.focus({ preventScroll: true })
                      }}
                    >
                      {/* A field with a query is text to take back, so the mark is the delete key. An
                          empty field has nothing to take, and the mark is the way out of the box. */}
                      {typed()
                        ? <BackspaceIcon size={20} />
                        : <AntIcon icon={CloseOutlined} size={18} />}
                    </Act>
                  </div>
                  {/* A picture is the other half of the enhanced search, so it leaves with the
                      switch that turns that search off. */}
                  <Show when={semanticOn()}>
                    <Act label={tr('picture.find')} pressed={picture.on} onClick={togglePicture}>
                      <AntIcon icon={PictureOutlined} size={18} />
                    </Act>
                  </Show>
                </div>
              </div>
            </div>

            <Show when={!picture.on()}>
              <button
                data-chrome="hit"
                data-press={press() ? 'true' : 'false'}
                class={CHROME_HIT}
                aria-label={tr('search.open')}
                onPointerDown={() => setPress(!isOpen())}
                onPointerUp={() => setPress(false)}
                onPointerCancel={() => setPress(false)}
                onPointerLeave={() => setPress(false)}
                onClick={() => (isOpen() ? close() : open())}
              >
                {/* One mark for both searches. The enhanced mode says what it is by the examples that
                    roll in the field, so the mark does not also have to change shape, and it keeps
                    pulsing in the accent color while a query is out. */}
                {/* 22, the size the corner's circles carry. The two circles on the field's own right
                    edge hold 18, so the mark outweighs them without crowding the plate's edge. */}
                <SparkMark
                  size="1.1em"
                  working={semanticPending}
                  icon={() => SearchOutlined}
                  class="chrome-mark"
                />
              </button>
            </Show>

            {/* Neither row shows while the box is shut: the plate is a circle then, and text that ran
                out of it would sit on the cards. */}
            <div
              class={`${CHROME_ROW} ${CHROME_ROW_TEXT} ${CHROME_TEXT_IN} ${CHROME_TEXT_OUT}`}
              data-chrome="text"
              classList={{ [CHROME_ROW_OUT]: !isOpen() || picture.on() }}
            >
              <SearchBar inputRef={(el) => (input = el)} onApi={setBar} />
            </div>

            <div
              class={`${CHROME_ROW} ${CHROME_ROW_PICTURE}`}
              data-chrome="picture"
              classList={{ [CHROME_ROW_OUT]: !isOpen() || !picture.on() }}
            >
              <PictureMode />
            </div>
          </div>
        </div>
      </div>

      {/* The pill stays in its box and is put away by CSS: leaving is a slide and a dissolve, and an
          element that is gone cannot animate. */}
      <div class={CHROME_TAB_BAR} data-chrome="tabs" data-picture={picture.on()}>
        <div class={CHROME_PILL} data-chrome="pill">
          <TabPill />
        </div>
      </div>
    </>
  )
}
