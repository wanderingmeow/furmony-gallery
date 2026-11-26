import { tr } from "../../i18n";
import { For, Show } from "solid-js";
import { CloseOutlined } from "@ant-design/icons-svg";
import { AntIcon } from "../ui/AntIcon";
import { SheetFab } from "../ui/SheetFab";
import {
  ART_PLACEHOLDER,
  DETAIL_THUMB,
  DETAIL_THUMB_INNER,
  DETAIL_THUMB_ROW,
  SHEET_FAB_BOX,
  SHEET_FAB_ROW,
  SHEET_HEADER_ROW,
  SHEET_TITLE,
} from "../ui/boxes";
import { SK_BOX } from "../ui/skeletonView";
import {
  BOX,
  detailPictureHeight,
  PANEL_GRID,
  sheetCardBox,
  type Shape,
} from "../../draw/layout";
import { watchViewport } from "../ui/viewport";

/** The detail's own wait, in the shape its screen gets and standing at the height the gallery will
 *  take: the card is as tall as its content, so a wait of another height moves the card the moment the
 *  listing lands.
 */
export function DetailPulse(props: { shape: Shape }) {
  const { viewportW, viewportH, safe } = watchViewport();
  const box = () => BOX[props.shape];
  const artH = () =>
    detailPictureHeight(
      sheetCardBox(viewportW(), viewportH(), safe()),
      props.shape,
      safe().top,
    );
  // One block, so the strip takes its own 8px and not the column's gap on top of it.
  const art = (
    <div>
      <div
        class={`sk-bar ${ART_PLACEHOLDER}`}
        style={{ height: `${artH()}px` }}
      />
      <div
        class={DETAIL_THUMB_ROW}
        style={{
          "margin-left": `${-box().stripBleed}px`,
          "margin-right": `${-box().stripBleed}px`,
          "padding-left": `${box().stripBleed}px`,
        }}
      >
        <div
          class={DETAIL_THUMB_INNER}
          style={{ "padding-right": `${box().stripBleed}px` }}
        >
          <For each={[0, 1, 2]}>
            {() => <div class={`sk-bar ${DETAIL_THUMB}`} />}
          </For>
        </div>
      </div>
    </div>
  );
  const lines = (
    <div class="flex flex-col gap-2.5">
      <span class={`sk-bar h-4 w-3/5 rounded-md ${SK_BOX}`} />
      <span class={`sk-bar h-4 w-full rounded-md ${SK_BOX}`} />
      <span class={`sk-bar h-4 w-4/5 rounded-md ${SK_BOX}`} />
      <span class={`sk-bar h-4 w-2/5 rounded-md ${SK_BOX}`} />
    </div>
  );
  return (
    <Show
      when={props.shape === "panel"}
      fallback={
        // The same space as `mt-4` on the table column in DetailBody, so the wait stands the height
        // of the body it holds the place of.
        <div class="sk-pulse flex flex-col gap-4">
          {art}
          {lines}
        </div>
      }
    >
      <div class={PANEL_GRID}>
        <div class={`sk-pulse col-start-1 row-start-1 ${box().colPad}`}>
          {art}
        </div>
        {/* The table column is out of the row's height here exactly as it is in the real body, so the
            gallery alone decides how tall the wait stands. */}
        <div class="col-start-2 row-start-1 relative">
          <div
            class={`sk-pulse absolute inset-0 overflow-hidden ${box().colPad}`}
          >
            {lines}
          </div>
        </div>
      </div>
    </Show>
  );
}

/**
 * The body of a sheet whose screen has not arrived yet.
 *
 * This is the one place that paints the ✕, for every sheet: the real one lives inside the
 * chunk, and until it lands the backdrop ignores taps and the drag has nothing to pull on. A
 * header row cannot hold it, because the detail screen has no header. Both screens put their
 * real ✕ 16px from the sheet's top left corner, so the placeholder's ✕ does not move.
 */
export function SheetBodySkeleton(props: {
  onClose: () => void;
  pad?: string;
  padX?: number;
}) {
  // The screen carries its own padding, and the placeholder repeats it so nothing moves on arrival.
  const inset = () =>
    props.padX
      ? {
          "padding-left": `${props.padX}px`,
          "padding-right": `${props.padX}px`,
        }
      : undefined;
  return (
    <div
      class={`min-h-full w-full${props.pad ? ` ${props.pad}` : ""}`}
      style={inset()}
    >
      <div class={SHEET_FAB_ROW}>
        <SheetFab label={tr("common.close")} onClick={props.onClose}>
          <AntIcon icon={CloseOutlined} size={22} />
        </SheetFab>
      </div>
      <SheetPulse />
    </div>
  );
}

/** The pulsing body on its own. A screen that already paints its own ✕ can cover a second wait
 *  with it - the detail does this while the listing list is still being fetched, so that wait
 *  continues the placeholder the chunk arrived on instead of dropping to a line of text.
 */
export function SheetPulse() {
  return (
    <div class="sk-pulse">
      <div class={`sk-bar ${ART_PLACEHOLDER} ${SK_BOX}`} />
      <div class="mt-5 flex flex-col gap-2.5">
        <span class={`sk-bar h-4 w-3/5 rounded-md ${SK_BOX}`} />
        <span class={`sk-bar h-4 w-full rounded-md ${SK_BOX}`} />
        <span class={`sk-bar h-4 w-4/5 rounded-md ${SK_BOX}`} />
        <span class={`sk-bar h-4 w-2/5 rounded-md ${SK_BOX}`} />
      </div>
    </div>
  );
}

/**
 * The header row that waits for the statistics header. It shows the name of the screen,
 * which the app knows without the chunk. The detail screen has no title, so only
 * statistics uses this.
 */
export function SheetTitleSkeleton(props: { title: string }) {
  return (
    <div class={SHEET_HEADER_ROW}>
      {/* The body placeholder paints a real ✕ here. */}
      <span class={`${SHEET_FAB_BOX} shrink-0`} />
      <h1 class={SHEET_TITLE}>{props.title}</h1>
    </div>
  );
}
