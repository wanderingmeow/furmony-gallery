// src/components/fab/panelParts.tsx - the shared parts every block in a corner panel is built
// from, so one block's spacing cannot drift from its neighbour's.
import type { JSXElement } from "solid-js";
import { tr } from "../../i18n";

/** A header row: 6px of padding, a 12px glyph, an 8px gap, then its name. */
export function PanelHeader(props: { icon: JSXElement; children: JSXElement }) {
  return (
    <div class="min-h-7 px-1.5 flex items-center gap-2 text-xs font-semibold">
      {props.icon} {props.children}
    </div>
  );
}

/** Section content lines up under the name. The indent is the header's own 6px padding, 12px
 *  glyph and 8px gap. */
export const UNDER_TEXT = "pl-[26px] pr-1.5";

// The line that explains the row above it. One class for all of them, so every note is the size
// its neighbours are.
export const UNDER_NOTE = `mt-1 mb-2 ${UNDER_TEXT} text-[11px] leading-relaxed text-muted`;

/** The line above a block, which is really the line between two: a block that stands first in its
 *  panel has nothing above it to divide from, and the glass edge is not one. The panel reads as the
 *  same blocks whether the folds around it are open or closed. */
export const PANEL_BLOCK = `mt-1.5 pt-1.5 border-t border-border
  first:mt-0 first:pt-0 first:border-0`;

/** 重置, in red because this is the row that takes things away; the panel it stands in says what it
 *  gives back. The row stays and goes gray when there is nothing to take back. */
export function ResetRow(props: {
  changed: () => boolean;
  onReset: () => void;
}) {
  return (
    <div class={PANEL_BLOCK}>
      <button
        class="w-full min-h-7 px-1.5 text-right text-xs font-semibold
               text-red-500 dark:text-red-400 disabled:text-faint"
        disabled={!props.changed()}
        onClick={() => props.onReset()}
      >
        {tr("filter.reset")}
      </button>
    </div>
  );
}
