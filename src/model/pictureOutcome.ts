import type { PictureResult } from "../data/searchApi";

/** What an answer means for the picture pipeline. An empty list with no reason is a complete
 *  answer that found nothing, not a broken search. */
export function outcomeOf(
  found: PictureResult,
): "busy" | "failed" | "none" | "done" {
  if (found.busy) return "busy";
  if (found.error) return "failed";
  return found.ids.length > 0 ? "done" : "none";
}
