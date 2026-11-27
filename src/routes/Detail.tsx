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
import { debuts } from "../stores/debutsStore";
import { detailImages } from "../model/domain";
import type { AdoptListing } from "../model/types";
import { gallerySlots } from "../components/gallery/slots";
import type { DetailEntry } from "../model/detailTrail";
import { sizedUrl, stableImageUrl } from "../data/image";
import { QuestionOutlined } from "@ant-design/icons-svg";
import { AntIcon } from "../components/ui/AntIcon";
import { EmptyNote } from "../components/ui/EmptyState";
import { SheetFab } from "../components/ui/SheetFab";
import { DetailPulse } from "../components/sheet/SheetSkeleton";
import { SHEET_FAB_ROW } from "../components/ui/boxes";
import { BOX, DETAIL_PAD_X, shapeAt } from "../draw/layout";
import { DetailBody } from "../components/detail/DetailBody";
import { FullScreenZoom } from "../components/gallery/FullScreenZoom";
import { scrollSheetToTop } from "../components/sheet/sheetScroll";
import { fitSheetCard, type FitCause } from "../components/sheet/sheetFit";
import { watchViewport } from "../components/ui/viewport";
import { heldLast } from "../components/ui/overlay";

export function Detail(props: { onClose: () => void }) {
  const params = useParams();
  const location = useLocation<DetailEntry>();
  // The sheet stays for one slide after the route is gone, and the id goes with it. heldLast falls
  // back only while the id is gone: an id that names no listing is a real miss, and the sheet has to
  // say so.
  const listing = heldLast<AdoptListing>(
    () => listings().find((l) => l.adoptId === Number(params.id)),
    () => !params.id,
  );

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
  // The debut album of Bilibili photos follows the studio's own art, so one swipe runs through both.
  const debut = createMemo(() => debuts().get(listing()?.adoptId ?? 0));
  const pictures = createMemo(() => [
    ...images(),
    ...(debut()?.pictures ?? []),
  ]);
  const clip = createMemo(() => debut()?.video);
  // The gallery paints resized copies; the zoom keeps the raw address for the whole picture.
  const shown = createMemo(() => pictures().map((u) => sizedUrl(u, "detail")!));
  // The strip under the picture stands at 60 pixels and asks for the badge size. The album addresses
  // carry no size of their own, so a strip of nine would otherwise pull the large copy of each.
  const thumbs = createMemo(() => pictures().map((u) => sizedUrl(u, "badge")!));
  // The clip's square, with the two sizes of cover it asks for. Its player costs more to show than
  // the whole first screen here, so the gallery hands over a cover and asks before it arrives.
  const square = createMemo(() => {
    const video = clip();
    if (!video) return undefined;
    return {
      url: sizedUrl(video.cover, "detail") ?? video.cover,
      thumb: sizedUrl(video.cover, "badge") ?? video.cover,
      clip: video,
    };
  });
  // One list of squares: the studio's own art, the clip, then the album of the debut day. The strip,
  // the highlight, the counter and a left-right gesture all read this one list.
  const slots = createMemo(() =>
    gallerySlots(shown(), thumbs(), square(), images().length),
  );
  const at = <T,>(list: T[]): T | undefined =>
    list[Math.min(index(), Math.max(0, list.length - 1))];
  const head = () => stableImageUrl(listing()?.adoptHeadPicture);
  // The zoom holds a picture, and the clip's box is already as big as it gets: the gallery leaves
  // the zoom alone while that square is on screen, so what is read here is a picture or the head.
  const current = (): string => {
    const one = at(slots());
    return one?.kind === "pic" ? one.url : (sizedUrl(head(), "detail") ?? "");
  };
  const currentFull = (): string => {
    const one = at(slots());
    const raw = one?.kind === "pic" ? pictures()[one.pic] : (head() ?? "");
    return sizedUrl(raw, "full") ?? "";
  };
  // With no detail pictures the zoom shows the head picture, so the counter reads 1 of 1.
  const zoomCount = () =>
    slots().length || (listing()?.adoptHeadPicture ? 1 : 0);

  // The card is as tall as its content, so each source that changes it measures again: a new listing
  // and a new window here, the picture and the table settling through DetailBody.
  let root!: HTMLDivElement;
  const fit = (cause: FitCause = "content") => fitSheetCard(root, cause);
  const { viewportW, viewportH } = watchViewport();
  const shape = () => shapeAt(viewportW(), viewportH());
  createEffect(
    on([() => params.id, viewportW, viewportH], ([id]) => {
      // No id means the sheet is sliding out: nothing new arrives to measure.
      if (!id) return;
      // Measured in the same task the content was written in: a frame of waiting is a frame the card
      // paints at the wrong height.
      fit("window");
    }),
  );

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
    <div ref={root} class="w-full bg-canvas flex flex-col">
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
            <div
              class={`flex-1 min-h-0 ${BOX[shape()].bodyPad}`}
              style={padX()}
            >
              <DetailPulse shape={shape()} />
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
            slots={slots()}
            index={index}
            setIndex={setIndex}
            onOpenFull={() => setFull(true)}
            onContentChange={() => fit()}
          />
        )}
      </Show>

      {/* The zoom goes to the body, so the sheet's overflow and transform cannot clip it */}
      <Show when={full()}>
        <Portal>
          <FullScreenZoom
            imageUrl={current() ?? ""}
            fullUrl={currentFull()}
            count={zoomCount()}
            index={index}
            onClose={() => setFull(false)}
          />
        </Portal>
      </Show>
    </div>
  );
}
