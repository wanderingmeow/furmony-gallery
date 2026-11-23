import { tr } from "../../i18n";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import type { AdoptListing } from "../../model/types";
import { filteredListings } from "../../stores/derivedStore";
import {
  firstVisibleId,
  setFirstVisibleId,
  persistSession,
} from "../../stores/sessionStore";
import { setOnFilterChange } from "../../stores/filterStore";
import { detailPattern, statsPattern } from "../../router";
import { useMatch } from "@solidjs/router";
import {
  GAP,
  LIST_BOTTOM,
  OVERSCAN_ROWS,
  VIEW_PAD,
  indexOfRow,
  renderWindow,
  rowOfIndex,
  waterfallCardWidth,
  waterfallCols,
  waterfallRowHeight,
} from "../../draw/layout";
import { SAVE_THROTTLE_MS, findIndex } from "../../draw/scrollRestore";
import {
  cardNeighbor,
  scrollForCard,
  type CardMove,
} from "../../draw/cardKeys";
import { createScrollMotion } from "../../draw/scrollMotion";
import { ListingCard } from "./ListingCard";
import { PreviewChip } from "./PreviewChip";
import { BackToTop } from "../fab/BackToTop";
import { EmptyState } from "../ui/EmptyState";
import { watchViewport } from "../ui/viewport";

export function Waterfall(props: {
  onOpen: (id: number) => void;
  topOffset: () => number;
}) {
  // The list scrolls the document (html/body), not an inner div: tapping the iOS status bar
  // and pressing Home on a desktop both act on the document's main scrollable. So these signals
  // follow the window.
  const { viewportH, frameW } = watchViewport();
  const [scrollTop, setScrollTop] = createSignal(window.scrollY);

  const items = filteredListings;
  const cols = createMemo(() => waterfallCols(frameW()));
  const cardWidth = createMemo(() => waterfallCardWidth(frameW(), cols()));
  const rowHeight = createMemo(() => waterfallRowHeight(cardWidth()));
  const rowCount = createMemo(() => Math.ceil(items().length / cols()));
  // the list reserves the pill's line below and the box's tallest room above, so neither edge's
  // chrome ever covers a row or moves one
  const topPad = createMemo(() => props.topOffset());
  const bottomPad = createMemo(() => LIST_BOTTOM);
  const contentHeight = createMemo(
    () => rowCount() * rowHeight() + topPad() + bottomPad(),
  );

  const win = createMemo(() =>
    renderWindow({
      scrollTop: scrollTop(),
      viewport: viewportH(),
      rowHeight: rowHeight(),
      rowCount: rowCount(),
      overscan: OVERSCAN_ROWS,
    }),
  );
  const firstRow = createMemo(() => win().firstRow);

  // A thumb dragged along the track replaces the whole window of cards every few frames, so the
  // pictures hold until the motion settles. draw/scrollMotion.ts holds the rule and the window.
  const [fastMotion, setFastMotion] = createSignal(false);
  const motion = createScrollMotion(setFastMotion);

  let raf = 0;
  // Scroll fires several times per frame, so the signal is written once per frame and the
  // layout memos run once instead of once per event.
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      setScrollTop(window.scrollY);
      motion.step(window.scrollY, performance.now());
    });
  };

  onMount(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    onCleanup(() => {
      window.removeEventListener("scroll", onScroll);
      motion.dispose();
    });
  });

  createScrollRestore({
    scrollToTop: (target) => window.scrollTo(0, target),
    items,
    cols,
    rowHeight,
    setScrollTop,
    firstRow,
    scrollTop,
    firstVisibleId,
    setFirstVisibleId,
    persistSession,
  });

  // A filter change starts the list from the top. The store slot is written here rather than in
  // the body, because the body runs on every render.
  onMount(() =>
    setOnFilterChange(() => {
      window.scrollTo(0, 0);
      setScrollTop(0);
    }),
  );
  onCleanup(() => setOnFilterChange(null));

  // The arrow keys walk the grid one row at a time: the card in the same column above or below.
  // A sheet over the list keeps focus on the card it came from, so the walk asks whether the list is
  // covered first, or the arrows move a grid nobody can see.
  const detailOpen = useMatch(() => detailPattern);
  const statsOpen = useMatch(() => statsPattern);
  let grid!: HTMLDivElement;
  const stepCard = (move: CardMove, from: number): boolean => {
    const to = cardNeighbor(from, cols(), items().length, move);
    if (to === null) return false; // the list ends here; the arrows scroll the page instead
    const card = grid?.querySelector<HTMLElement>(`[data-card-index="${to}"]`);
    if (!card) return false;
    // The browser would align the card to the edge of the viewport, which is under the band.
    card.focus({ preventScroll: true });
    const target = scrollForCard({
      rowTop: topPad() + Math.floor(to / cols()) * rowHeight(),
      rowHeight: rowHeight(),
      scrollY: window.scrollY,
      viewport: viewportH(),
      topPad: topPad(),
      bottomPad: bottomPad(),
    });
    if (target !== window.scrollY) window.scrollTo(0, target);
    return true;
  };

  const ARROWS: Record<string, CardMove> = {
    ArrowDown: "down",
    ArrowUp: "up",
    ArrowRight: "right",
    ArrowLeft: "left",
  };

  const onGridKey = (event: KeyboardEvent): void => {
    const move = ARROWS[event.key];
    if (!move) return;
    if (detailOpen() || statsOpen()) return;
    // Only a key raised inside the grid walks it.
    const from =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("[data-card-index]")
        : null;
    if (!from) return;
    const index = Number(from.dataset.cardIndex);
    if (!Number.isInteger(index)) return;
    if (stepCard(move, index)) event.preventDefault();
  };

  return (
    <>
      {/* The empty state shares this column with the list and the band, so the column is what
          centers it: the box takes whatever room the first screen leaves after the two of them,
          and the page ends where the screen ends. */}
      <main class="flex min-h-dvh flex-col">
        {/* Normal document flow, for the reason stated above. The list starts under the band, and
            the band's bar is a fixed height whatever the field inside it does, so nothing the search
            box does to its own shape moves these cards. */}
        <div
          class="relative w-full"
          onKeyDown={onGridKey}
          ref={grid}
          style={{
            height: `${contentHeight()}px`,
            "padding-top": `${topPad()}px`,
            "padding-right": `calc(${VIEW_PAD}px + var(--safe-right))`,
            "padding-left": `calc(${VIEW_PAD}px + var(--safe-left))`,
          }}
        >
          <div
            class="virtual-content"
            style={{
              position: "relative",
              transform: `translateY(${win().start * rowHeight()}px)`,
              width: `${cols() * cardWidth() + GAP * (cols() - 1)}px`,
              height: `${(win().end - win().start) * rowHeight()}px`,
            }}
          >
            <VirtualCards
              items={items}
              start={() => win().start}
              end={() => win().end}
              cols={cols}
              cardWidth={cardWidth}
              rowHeight={rowHeight}
              onOpen={props.onOpen}
              hold={fastMotion}
            />
          </div>
        </div>
        <Show when={items().length === 0}>
          <EmptyState />
        </Show>
        <CopyrightBand />
      </main>

      <PreviewChip
        items={items}
        scrollTop={scrollTop}
        rowHeight={rowHeight}
        cols={cols}
        topPad={topPad}
      />

      <BackToTop
        scrollTop={scrollTop}
        // smooth, because the scroll events it fires keep the preview chip in step
        onTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      />
    </>
  );
}

// In normal flow, so its height follows the text it holds: the copyright line wraps to two lines
// on a phone and one on a desktop. What it keeps free below itself is the pill and the air around it.
function CopyrightBand() {
  return (
    <div
      class="w-full text-center text-sm text-muted px-6 pt-5 border-t border-border"
      style={{
        "padding-bottom": `calc(${LIST_BOTTOM}px + var(--safe-bottom))`,
      }}
    >
      {tr("band.copyright")}
      <div class="mt-1.5">
        {tr("band.codeBefore")}{" "}
        <a
          href="https://github.com/wanderingmeow/furmony-gallery/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          class="text-accent-soft hover:underline"
        >
          {tr("band.license")}
        </a>{" "}
        {tr("band.codeAfter")} ·{" "}
        <a
          href="https://github.com/wanderingmeow/furmony-gallery"
          target="_blank"
          rel="noopener noreferrer"
          class="text-accent-soft hover:underline"
        >
          {tr("band.repository")}
        </a>
      </div>
    </div>
  );
}

// Restores the saved top row once per mount, then keeps it saved. It is a function rather
// than inline code so the timers and the cleanup do not sit in the component.
function createScrollRestore(args: {
  scrollToTop: (target: number) => void;
  items: () => AdoptListing[];
  cols: () => number;
  rowHeight: () => number;
  setScrollTop: (v: number) => void;
  firstRow: () => number;
  scrollTop: () => number;
  firstVisibleId: () => number | null;
  setFirstVisibleId: (v: number | null) => void;
  persistSession: (id: number | null) => void;
}) {
  // read once: as a dependency it would wait for the first row the user passes and restore that
  const saved = args.firstVisibleId();
  // The restore runs once per page visit, so `done` is a local: every remount starts with a fresh
  // one.
  let done = false;
  createEffect(
    on([args.items, args.cols, args.rowHeight], ([items, cols, rowHeight]) => {
      if (
        done ||
        saved == null ||
        cols <= 0 ||
        rowHeight <= 0 ||
        items.length === 0
      )
        return;
      done = true;
      const row = rowOfIndex(findIndex(items, saved), cols);
      // The saved row sat at y=topPad when it was captured, and the content's padding-top
      // still provides that offset, so the target is row*rowHeight with NO topPad. Adding
      // it would land the card at y=0, behind the band.
      const target = row * rowHeight;
      args.scrollToTop(target);
      args.setScrollTop(target);
    }),
  );

  // At the top (row <= 0) any saved position is dropped, so a refresh lands at the top
  // instead of returning to the previous spot.
  const saveRow = (row: number) => {
    if (row <= 0) {
      if (args.firstVisibleId() != null) {
        args.setFirstVisibleId(null);
        args.persistSession(null);
      }
      return;
    }
    const item =
      args.items()[indexOfRow(row, args.cols(), args.items().length)];
    if (item) {
      args.setFirstVisibleId(item.adoptId);
      args.persistSession(item.adoptId);
    }
  };

  // Depends on firstRow, which changes at row boundaries only, so the body does not run on
  // every scroll frame.
  let saveTimer: number | null = null;
  createEffect(
    on(args.firstRow, () => {
      // Read the row inside the timer: a value captured here could go stale and clear or save
      // the wrong row.
      if (saveTimer) return;
      saveTimer = setTimeout(() => {
        saveTimer = null;
        saveRow(args.firstRow());
      }, SAVE_THROTTLE_MS);
    }),
  );
  onCleanup(() => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    // final save on exit - read the CURRENT scrollTop (the memo may be mid-disposal)
    saveRow(Math.floor(args.scrollTop() / args.rowHeight()));
  });
}

// Solid's <For> matches rows by object identity, so a row that comes back as the same object
// keeps its card and its DOM node wherever the row moves. Scroll and drag only write top/left,
// and a cover keeps the picture it already decoded: a card that remounted would load its cover
// again, and the user sees it arrive. Only cards entering the window mount.
function VirtualCards(props: {
  items: () => AdoptListing[];
  start: () => number;
  end: () => number;
  cols: () => number;
  cardWidth: () => number;
  rowHeight: () => number;
  onOpen: (id: number) => void;
  hold: () => boolean;
}) {
  const first = () => props.start() * props.cols();
  const count = () => (props.end() - props.start()) * props.cols();
  const visible = createMemo(() =>
    props.items().slice(first(), first() + count()),
  );
  return (
    // The index <For> hands over is the offset inside this slice, so no offset map is
    // rebuilt when a row boundary changes.
    <For each={visible()}>
      {(l, i) => (
        <CardSlot
          listing={l}
          offset={() => i()}
          index={() => first() + i()}
          cols={props.cols}
          cardWidth={props.cardWidth}
          rowHeight={props.rowHeight}
          onOpen={props.onOpen}
          hold={props.hold}
        />
      )}
    </For>
  );
}

function CardSlot(props: {
  listing: AdoptListing;
  offset: () => number;
  index: () => number;
  cols: () => number;
  cardWidth: () => number;
  rowHeight: () => number;
  onOpen: (id: number) => void;
  hold: () => boolean;
}) {
  const row = () => Math.floor(props.offset() / props.cols());
  const col = () => props.offset() % props.cols();
  return (
    <div
      style={{
        position: "absolute",
        top: `${row() * props.rowHeight()}px`,
        left: `${col() * (props.cardWidth() + GAP)}px`,
        width: `${props.cardWidth()}px`,
      }}
    >
      <button
        class="press-host card-press text-left"
        data-card-index={props.index()}
        onClick={() => props.onOpen(props.listing.adoptId)}
      >
        <ListingCard
          listing={props.listing}
          width={props.cardWidth()}
          hold={props.hold}
        />
      </button>
    </div>
  );
}
