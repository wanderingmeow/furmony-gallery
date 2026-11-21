import { tr } from "../i18n";
import { listingName } from "../model/translatedText";
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { useParams, useLocation } from "@solidjs/router";
import { ArrowLeftOutlined, CloseOutlined } from "@ant-design/icons-svg";
import { listings, isLoading, dataReady } from "../stores/listingsStore";
import { detailImages } from "../model/domain";
import type { AdoptListing } from "../model/types";
import type { DetailEntry } from "../model/detailTrail";
import { sizedUrl, stableImageUrl } from "../data/image";
import { QuestionOutlined } from "@ant-design/icons-svg";
import { AntIcon } from "../components/ui/AntIcon";
import { EmptyNote } from "../components/ui/EmptyState";
import { SheetFab } from "../components/ui/SheetFab";
import { SheetPulse } from "../components/sheet/SheetSkeleton";
import { SHEET_FAB_ROW } from "../components/ui/boxes";
import { BOX, DETAIL_PAD_X } from "../draw/layout";
import { DetailBody } from "../components/detail/DetailBody";
import { FullScreenZoom } from "../components/detail/FullScreenZoom";
import { scrollSheetToTop } from "../components/sheet/Sheet";

export function Detail(props: { onClose: () => void }) {
  const params = useParams();
  const location = useLocation<DetailEntry>();
  // The sheet stays for one slide after the route is gone, and the id goes with it. Without
  // the last listing, that slide would show "未找到该设定".
  let lastSeen: AdoptListing | undefined;
  const listing = createMemo(() => {
    const found = listings().find((l) => l.adoptId === Number(params.id));
    if (found) lastSeen = found;
    return params.id ? found : lastSeen;
  });

  const [index, setIndex] = createSignal(0);
  const [full, setFull] = createSignal(false);

  // Only a related tap sets this field. The grid, a link and the notification panel leave it
  // empty, so there is no ← to draw. See model/detailTrail.
  const cameFrom = () => location.state?.fromDetail;
  const backLabel = () => {
    const from = cameFrom();
    const l = listings().find((x) => x.adoptId === from);
    const name = l ? listingName(l) : undefined;
    return name
      ? `${tr("common.back")} #${from} ${name}`
      : `${tr("common.back")} #${from}`;
  };

  createEffect(
    on(
      () => params.id,
      (id) => {
        // No id means the sheet is sliding out: keep the last listing on screen while it goes.
        if (!id) return;
        setIndex(0); // how far the old listing was paged through says nothing about this one
        // Otherwise the zoom would still show the listing you came from.
        setFull(false);
        // A related tap navigates detail → detail and leaves this component mounted, so
        // without this the reader stays where the old listing left them. The scroll is
        // animated: the new cover should arrive as travel, not as a cut.
        scrollSheetToTop();
      },
    ),
  );

  // The placeholder stands in for the body, so it pads itself the way the sheet's body does.
  const padX = () => ({
    "padding-left": `${DETAIL_PAD_X}px`,
    "padding-right": `${DETAIL_PAD_X}px`,
  });

  const goBack = () => history.back();

  // The title follows the sheet: a detail reads "#ID NAME - Furmony Gallery".
  createEffect(
    on(listing, (l) => {
      if (l)
        document.title = `#${l.adoptId} ${listingName(l) ?? ""} - Furmony Gallery`;
    }),
  );
  onCleanup(() => {
    document.title = "Furmony Gallery";
  });

  const images = createMemo(() => {
    const l = listing();
    return l ? detailImages(l) : [];
  });
  // The gallery paints resized copies; the zoom keeps the raw address for the whole picture.
  const shown = createMemo(() => images().map((u) => sizedUrl(u, "detail")!));
  const at = (list: string[]): string | undefined =>
    list[Math.min(index(), Math.max(0, list.length - 1))];
  const head = () => stableImageUrl(listing()?.adoptHeadPicture);
  const current = () => at(shown()) ?? sizedUrl(head(), "detail");
  const currentRaw = () => at(images()) ?? head();
  // With no detail pictures the zoom shows the head picture, so the counter reads 1 of 1.
  const zoomCount = () =>
    images().length || (listing()?.adoptHeadPicture ? 1 : 0);

  // Esc closes the sheet. While the zoom is open it takes Esc, so a single press
  // closes one layer instead of both.
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !full()) props.onClose();
    };
    document.addEventListener("keydown", handler);
    onCleanup(() => document.removeEventListener("keydown", handler));
  });

  return (
    <div class="min-h-full w-full bg-canvas flex flex-col">
      {/* Detail has no header bar: these float over content that spans the sheet and scrolls
          under them. ✕ closes the sheet from any level. The ← appears only after a related
          tap, and it follows the same history entries the browser's back follows. */}
      <div class={SHEET_FAB_ROW}>
        <SheetFab label={tr("common.close")} onClick={props.onClose}>
          <AntIcon icon={CloseOutlined} size={22} />
        </SheetFab>
        <Show when={cameFrom() !== undefined}>
          <SheetFab label={backLabel()} onClick={goBack}>
            <AntIcon icon={ArrowLeftOutlined} size={20} />
          </SheetFab>
        </Show>
      </div>

      <Show
        when={listing()}
        fallback={
          /* A deep link is not a missing id until the data has had its chance, so the wait keeps the
             placeholder the chunk arrived on. Only a list that has landed and does not hold the id
             is a missing listing. */
          !dataReady() || isLoading() ? (
            <div class={`flex-1 min-h-0 ${BOX.sheet.bodyPad}`} style={padX()}>
              <SheetPulse />
            </div>
          ) : (
            <div class="flex flex-1 flex-col items-center justify-center gap-1.5 px-8 py-10 text-center">
              <EmptyNote
                icon={QuestionOutlined}
                title={tr("detail.notFound")}
              />
            </div>
          )
        }
      >
        {(l) => (
          <DetailBody
            listing={l()}
            images={shown()}
            index={index}
            setIndex={setIndex}
            onOpenFull={() => setFull(true)}
          />
        )}
      </Show>

      {/* The zoom goes to the body, so the sheet's overflow and transform cannot clip it */}
      <Show when={full()}>
        <Portal>
          <FullScreenZoom
            imageUrl={current() ?? ""}
            fullUrl={currentRaw() ?? ""}
            count={zoomCount()}
            index={index}
            onClose={() => setFull(false)}
          />
        </Portal>
      </Show>
    </div>
  );
}
