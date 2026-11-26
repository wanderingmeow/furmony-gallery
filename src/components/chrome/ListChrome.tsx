import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";
import { BarChartOutlined, SearchOutlined } from "@ant-design/icons-svg";
import { useMatch, useNavigate } from "@solidjs/router";
import { tr } from "../../i18n";
import { searchText } from "../../stores/filterStore";
import {
  picture,
  semanticOn,
  semanticPending,
} from "../../stores/semanticStore";
import { warmSearch } from "../../data/searchApi";
import { AntIcon } from "../ui/AntIcon";
import { SparkMark } from "../ui/spark";
import {
  CHROME_BAND,
  CHROME_BAR_BOX,
  CHROME_CORNER,
  CHROME_FIELD,
  CHROME_HIT,
  CHROME_LINE,
  CHROME_PILL,
  CHROME_ROW,
  CHROME_ROW_OUT,
  CHROME_ROW_PICTURE,
  CHROME_ROW_TEXT,
  CHROME_STATS,
  CHROME_TAB_BAR,
  CHROME_TEXT_IN,
  CHROME_TEXT_OUT,
  PLATE_OPEN_R,
  PLATE_REST_R,
} from "../ui/boxes";
import { TabPill } from "./TabPill";
import { CornerActions } from "../fab/CornerActions";
import { FabCircle } from "../fab/FabCircle";
import { detailPattern, statsPath } from "../../router";
import { statsTitle } from "../../model/titles";
import { SearchBar, type SearchBarApi } from "./SearchBar";
import { PictureMode } from "./PictureSearch";
import { watchViewport } from "../ui/viewport";
import { holdPage } from "../../draw/pageHold";
import { FieldPlate } from "./FieldPlate";
import { FIELD_VARS, fieldShape, fieldVars, plateAir } from "./fieldGeometry";

/** The entry a box the user opened leaves on the stack. Every way back arrives as one popstate,
 *  and only the entry's own state says whether the pop answered something stacked above it. */
type Stand = { searchStand?: boolean };
const standing = () => !!(history.state as Stand | null)?.searchStand;

/** The field holds one search at a time: a picture replaces the text row and takes the tall box,
 *  and the pill leaves the bottom edge because the box is the way out of a picture.
 *
 *  The field grows over the cards rather than pushing them down, so nothing here moves the page. */
export function ListChrome() {
  const navigate = useNavigate();
  const [held, setHeld] = createSignal(false);
  // The press belongs to the gesture that asked the box open, so it is settled when the finger goes
  // down: a press made while the box is open is on its way out and must not grow the circle.
  const [press, setPress] = createSignal(false);
  // the box hands its controls over, so the × holds its place while the box changes shape
  const [bar, setBar] = createSignal<SearchBarApi>();
  let input!: HTMLInputElement;

  // a restored query or a staged picture is something the user should see what is answering
  const shape = () =>
    fieldShape(
      held() || searchText().length > 0 || picture.on(),
      picture.on(),
      picture.state(),
    );
  const isOpen = () => shape() !== "shut";
  // the typing itself, which runs ahead of the query the wait commits
  const typed = () => bar()?.hasText() ?? false;

  // the corner and the placeholder band are separate fixed elements, so the field's numbers go on
  // the document root for them to read
  createEffect(
    on(shape, (held) => {
      const root = document.documentElement;
      for (const [name, value] of Object.entries(fieldVars(held)))
        root.style.setProperty(name, value);
    }),
  );
  onCleanup(() => {
    const root = document.documentElement;
    for (const name of FIELD_VARS) root.style.removeProperty(name);
  });

  const { frameW } = watchViewport();

  const open = () => {
    warmSearch();
    setHeld(true);
    if (!standing())
      history.pushState({ ...history.state, searchStand: true }, "");
    // Safari raises a keyboard only for a focus it is asked for inside the tap, so this cannot wait
    // for the box to finish growing. A query restored on load opens the box without this call.
    input.focus({ preventScroll: true });
    // a second ask next frame is outside the gesture: the caret arrives, the keyboard does not
    if (document.activeElement !== input) {
      requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }
  };
  const close = () => {
    bar()?.clear();
    setHeld(false);
    // the blur and the history step are both scroll requests: draw/pageHold.ts keeps this number
    const at = window.scrollY;
    input.blur();
    leaveStand();
    holdPage(at);
  };

  const leaveStand = () => {
    if (!standing()) return;
    history.back();
  };

  // Back, however it was made
  const onPop = () => {
    if (!standing() && isOpen()) close();
  };
  window.addEventListener("popstate", onPop);
  onCleanup(() => window.removeEventListener("popstate", onPop));
  // a draft an input method is holding takes Escape first, so that one stays with the input method
  const onKey = (e: KeyboardEvent) => {
    if (
      e.key === "Escape" &&
      !e.isComposing &&
      document.activeElement === input
    )
      close();
  };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));

  // The sheet stands above the band, and the full-screen zoom stands inside it. Escape on either
  // one is an answer to what is nearest, and the ranking behind keeps its picture.
  const sheetUp = useMatch(() => detailPattern);

  // Escape leaves picture mode whichever state it is in: a picture the device is still reading,
  // bytes on their way, a wait at the service, or a ranking already drawn. The band holds the mode
  // through all of them, so the one thing this key can mean here is going back to the plain list.
  const onPictureKey = (e: KeyboardEvent): void => {
    if (e.key !== "Escape" || e.isComposing) return;
    if (!picture.on() || sheetUp()) return;
    picture.close();
  };
  window.addEventListener("keydown", onPictureKey);
  onCleanup(() => window.removeEventListener("keydown", onPictureKey));

  const togglePicture = () => {
    // the file search is the longest pause in this path, so the service trip is paid inside it
    warmSearch();
    if (picture.on()) picture.close();
    else picture.open();
  };
  // ⌫ gives the text up, not the box: the caret stays in the field
  const clearText = () => {
    bar()?.clear();
    setHeld(true);
    input.focus({ preventScroll: true });
  };
  return (
    <>
      {/* Every part of the band is drawn with utility classes, so these names are what a check that
          measures the band reads. The two attributes say which shape the band is in. */}
      <div
        class={CHROME_BAND}
        data-chrome="band"
        data-open={isOpen()}
        data-picture={picture.on()}
      >
        <div class={CHROME_BAR_BOX}>
          <div class={CHROME_LINE}>
            {/* The charts are the way out of the list, and an open box is the user working inside
                it, so this circle gives its place to the field it sits beside. */}
            <div class={CHROME_STATS} data-chrome="stats">
              <FabCircle
                onClick={() => navigate(statsPath(), { scroll: false })}
                title={statsTitle()}
              >
                <AntIcon icon={BarChartOutlined} size={22} />
              </FabCircle>
            </div>

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
              "--chrome-acts": picture.on() || !semanticOn() ? "56px" : "100px",
              "--plate-r": isOpen() ? PLATE_OPEN_R : PLATE_REST_R,
              "--plate-air": plateAir(shape(), frameW()),
            }}
          >
            <FieldPlate
              open={isOpen}
              typed={typed}
              pictureOn={picture.on}
              semanticOn={semanticOn}
              onFocusField={() => input.focus({ preventScroll: true })}
              onClose={close}
              onClearText={clearText}
              onTogglePicture={togglePicture}
            />

            <Show when={!picture.on()}>
              <button
                data-chrome="hit"
                data-press={press() ? "true" : "false"}
                class={CHROME_HIT}
                aria-label={tr("search.open")}
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
      <div
        class={CHROME_TAB_BAR}
        data-chrome="tabs"
        data-picture={picture.on()}
      >
        <div class={CHROME_PILL} data-chrome="pill">
          <TabPill />
        </div>
      </div>
    </>
  );
}
