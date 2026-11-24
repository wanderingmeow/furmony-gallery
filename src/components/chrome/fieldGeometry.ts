import {
  CHROME_WIDE,
  FIELD_DROP,
  FIELD_LEAD,
  FIELD_PICTURE,
  FIELD_REST,
  FIELD_TEXT,
  FIELD_WIDE,
  PLATE_AIR,
} from "../../draw/layout";
import type { PictureState } from "../../stores/semanticStore";

/** Which box the field stands in. The empty drop zone is the tall one; a staged picture and one that
 *  could not be read share a row. */
export type FieldShape = "shut" | "text" | "drop" | "picture";

export function fieldShape(
  open: boolean,
  pictureOn: boolean,
  state: PictureState,
): FieldShape {
  if (!open) return "shut";
  if (!pictureOn) return "text";
  return state === "empty" ? "drop" : "picture";
}

/** The field grows over the cards, so this height moves the box and the rows inside it only. */
export function fieldHeight(shape: FieldShape): number {
  if (shape === "drop") return FIELD_DROP;
  if (shape === "picture") return FIELD_PICTURE;
  if (shape === "text") return FIELD_TEXT;
  return FIELD_REST;
}

/** The numbers the corner and the placeholder band read off the root: `--field-h` is the box,
 *  `--field-text` the line the circles stand centred on, `--field-lead` where a row starts. */
export const FIELD_VARS = [
  "--field-h",
  "--field-text",
  "--field-lead",
] as const;

export function fieldVars(shape: FieldShape): Record<string, string> {
  return {
    "--field-h": `${fieldHeight(shape)}px`,
    "--field-text": `${FIELD_TEXT}px`,
    "--field-lead": `${shape === "shut" ? FIELD_REST : FIELD_LEAD}px`,
  };
}

/** How far the plate stands back from the field's right edge: the corner's circle and 8px on a phone,
 *  a fixed measure on an edge wide enough for one. The rows inset from the same number. */
export function plateAir(shape: FieldShape, frameW: number): string {
  if (shape === "shut") return "0px";
  return frameW >= CHROME_WIDE ? `calc(100% - ${FIELD_WIDE}px)` : PLATE_AIR;
}
