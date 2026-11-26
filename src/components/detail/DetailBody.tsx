import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { AdoptListing } from "../../model/types";
import type { GallerySlot } from "../gallery/slots";
import {
  BOX,
  DETAIL_PAD_X,
  detailClipHeight,
  detailPictureHeight,
  PANEL_GRID,
  shapeAt,
  sheetCardBox,
} from "../../draw/layout";
import type { Shape } from "../../draw/layout";
import { watchViewport } from "../ui/viewport";
import { useSheetFooter } from "../ui/boxes";
import { AnimatedHeight } from "../ui/AnimatedHeight";
import { DetailToolbar } from "./DetailToolbar";
import { Gallery } from "../gallery/Gallery";
import { InfoTable } from "./InfoTable";
import { RelatedRow } from "./RelatedRow";

/**
 * The detail's content, in whichever shape its screen gets: a sheet's one column under the pictures,
 * or a panel's picture beside the table. The action bar belongs here too, because which box it sits
 * in is a shape decision.
 */
export function DetailBody(props: {
  listing: AdoptListing;
  /** The gallery's squares in the order a user swipes them: the resized pictures, with the debut's
   *  clip standing among them as one more square. */
  slots: GallerySlot[];
  index: () => number;
  setIndex: (i: number) => void;
  onOpenFull: () => void;
  /** Something inside grew or shrank, so the card around this measures again. */
  onContentChange?: () => void;
}) {
  const { viewportW, viewportH, safe } = watchViewport();
  const shape = (): Shape => shapeAt(viewportW(), viewportH());
  const panel = () => shape() === "panel";
  const box = () => BOX[shape()];
  const cardBox = () => sheetCardBox(viewportW(), viewportH(), safe());
  const picMaxH = () => detailPictureHeight(cardBox(), shape(), safe().top);
  const clipMaxH = () => detailClipHeight(cardBox(), shape(), safe().top);
  const footerHost = useSheetFooter();

  return (
    <>
      {/* The body's own padding comes from BOX: a sheet pads all four sides here, a panel the sides
          only and leaves the top and the bottom to each column. */}
      <div
        class={`flex-1 min-h-0 ${box().bodyPad}`}
        style={{
          "padding-left": `${DETAIL_PAD_X}px`,
          "padding-right": `${DETAIL_PAD_X}px`,
        }}
      >
        <div class={panel() ? PANEL_GRID : undefined}>
          <div
            class={
              panel() ? `col-start-1 row-start-1 ${box().colPad}` : undefined
            }
          >
            <Gallery
              slots={props.slots}
              index={props.index}
              setIndex={props.setIndex}
              onOpenFull={props.onOpenFull}
              maxH={picMaxH()}
              clipMaxH={clipMaxH()}
              bleed={() => BOX[shape()].stripBleed}
              holdHeight={panel()}
              onPicHeightChange={props.onContentChange}
            />
          </div>
          {/* The table column is laid out inside a box pinned to this cell: the row is the gallery's
              height, and a column still in flow would stretch that row to the whole table. Inside
              the box the column is the scroller over a bar that stays put. */}
          <div class={panel() ? "col-start-2 row-start-1 relative" : "mt-4"}>
            <div
              class={
                panel() ? "absolute inset-0 flex flex-col min-h-0" : undefined
              }
            >
              {/* The column scrolls on its own and the bar sits under it, so the picture stays put
                while the table moves. The marker only exists here: the scroll lock reads it, and a
                sheet has one scroller, its own. */}
              <div
                data-sheet-col-scroll={panel() ? "" : undefined}
                class={
                  panel()
                    ? `min-h-0 flex-1 overflow-y-auto overscroll-contain ${box().colPad}`
                    : undefined
                }
              >
                <AnimatedHeight onHeightChange={props.onContentChange}>
                  <InfoTable listing={props.listing} />
                </AnimatedHeight>
                <RelatedRow item={props.listing} shape={shape()} />
              </div>
              {panel() && <DetailToolbar item={props.listing} shape="panel" />}
            </div>
          </div>
        </div>
      </div>

      {/* The bar belongs to this screen, so it travels in this chunk. A sheet puts it in the box the
          shell keeps outside the scroller, where it cannot cover the scrollbar; a panel keeps it in
          the right column. */}
      {footerHost && (
        <Show when={!panel()}>
          <Portal mount={footerHost} useShadow={false}>
            <DetailToolbar item={props.listing} shape="sheet" />
          </Portal>
        </Show>
      )}
    </>
  );
}
