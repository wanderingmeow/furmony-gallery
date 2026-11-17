// src/model/detailTrail.ts: how the app knows which step a detail entry came from.

/**
 * The state that a tap on a related card writes on the history entry it pushes. `fromDetail`
 * is the listing that the reader came from, so reading the entry you are standing on tells the
 * app whether ← has somewhere to go.
 *
 * The marker lives on the entry because back and forward move between entries. `history.state`
 * is stored per entry: going back gives you the marker the earlier hop wrote, a reload keeps
 * it, and forward brings it back. Nothing else has to agree with the browser, and a detail
 * opened in a fresh tab simply has no ←.
 */
export interface DetailEntry {
  fromDetail?: number
}
