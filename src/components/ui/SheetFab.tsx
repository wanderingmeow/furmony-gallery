import type { JSX } from "solid-js";
import { SHEET_FAB_BOX } from "./boxes";

/**
 * The round button that floats over a sheet: the ✕ that closes it, and the ← that goes
 * back to the listing you looked at just before.
 *
 * This row is `position: absolute` with the sheet card as its containing block, so a pan
 * that starts here belongs to the document. The browser reads `touch-action` up the DOM and
 * stops at the sheet's scroller, so `touch-none` has to sit on the button.
 */
export function SheetFab(props: {
  label: string;
  onClick: () => void;
  children: JSX.Element;
}) {
  return (
    <button
      class={`${SHEET_FAB_BOX} press-fab relative cursor-pointer touch-none rounded-full glass sheet-fab flex items-center justify-center border border-border`}
      onClick={() => props.onClick()}
      aria-label={props.label}
      title={props.label}
    >
      {props.children}
    </button>
  );
}
