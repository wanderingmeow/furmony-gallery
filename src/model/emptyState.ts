// src/model/emptyState.ts - what to say when the list has nothing to show.
//
// An empty list that shows nothing at all leaves the user to work out which of several things
// went wrong, with the copyright band sitting where the cards were. These states say which one
// happened, and the button under them does the fix.
import { tr } from "../i18n";

export type EmptyIcon = "heart" | "search" | "filter" | "spark" | "warning";

/** What the picture's own answer amounts to, or null while the picture says nothing about the
 *  empty list. */
export type PictureSay = "failed" | "noMatch";

/** What the user can press. The component knows what each one does. */
export type EmptyAction =
  "search" | "filters" | "retry" | "retryAsk" | "socialOnly" | "debutOnly";

export interface EmptyFacts {
  loadFailed: boolean;
  /** Something is still working: the enhanced search has not answered for the sentence in the
   *  box, or the picture search is still running. */
  asking: boolean;
  /** The switch that keeps only the listings whose owner has an account we can link to. */
  socialOnly: boolean;
  debutOnly: boolean;
  onWishlistTab: boolean;
  savedCount: number;
  query: string;
  /** How many picks the user made: the colors, the species, and the price range as one pick. */
  picked: number;
  /** Dropping those picks would bring results back, so the picks are what emptied the list. */
  filtersAreTheCause: boolean;
  /** The request about this sentence ended with nothing in hand. A service that answered and
   *  found nothing is a normal empty answer, so that is not a failure. */
  sentenceFailed: boolean;
  pictureSay: PictureSay | null;
}

export interface EmptyState {
  icon: EmptyIcon;
  title: string;
  line?: string;
  action?: EmptyAction;
}

/** A sentence the user typed, shortened to fit one line of a title. */
function shortQuery(q: string): string {
  return q.length > 20 ? `${q.slice(0, 20)}…` : q;
}

/** The order is the meaning, and the test `holds the order the reasons are told in` pins it.
 *  Two placements need a reason: a failed request comes before the words, because the words
 *  were never looked at, and the picture case has no button, because its banner already
 *  carries the chips.
 *
 * Null means there is nothing to say yet. The grid keeps the list it already had while an
 * answer is on its way, so the space under it stays empty too: 没有「…」相关设定 would be a
 * guess about a reply still on its way.
 */
export function pickEmptyState(f: EmptyFacts): EmptyState | null {
  if (f.asking) return null;
  if (f.loadFailed) {
    return {
      icon: "warning",
      title: tr("empty.fetchFailedTitle"),
      line: tr("empty.fetchFailedAction"),
      action: "retry",
    };
  }
  if (f.socialOnly) {
    return {
      icon: "filter",
      title: tr("empty.noSocialTitle"),
      action: "socialOnly",
    };
  }
  if (f.debutOnly) {
    return {
      icon: "filter",
      title: tr("empty.noDebutTitle"),
      action: "debutOnly",
    };
  }
  if (f.onWishlistTab && f.savedCount === 0) {
    // The tab pills stay on screen, so this case has nothing to hand back.
    return { icon: "heart", title: tr("empty.noWishTitle") };
  }
  if (f.pictureSay) {
    return f.pictureSay === "failed"
      ? {
          icon: "spark",
          title: tr("empty.pictureFailedTitle"),
          line: tr("empty.pictureFailedAction"),
        }
      : {
          icon: "spark",
          title: tr("empty.pictureNoneTitle"),
          line: tr("empty.pictureNoneAction"),
        };
  }
  if (f.sentenceFailed) {
    return {
      icon: "spark",
      title: tr("empty.enhanceFailedTitle"),
      line: tr("empty.enhanceFailedLine"),
      action: "retryAsk",
    };
  }
  if (f.query && f.filtersAreTheCause) {
    return {
      icon: "filter",
      title: tr("empty.filtersTitle"),
      action: "filters",
    };
  }
  if (f.query) {
    return {
      icon: "search",
      title: tr("empty.queryTitle", shortQuery(f.query)),
      line: tr("empty.queryLine"),
      action: "search",
    };
  }
  if (f.picked) {
    return {
      icon: "filter",
      title: tr("empty.filtersTitle"),
      action: "filters",
    };
  }
  // the sentence above the button is not something to act on, so this one carries a button
  return {
    icon: "search",
    title: tr("empty.nothingTitle"),
    line: tr("empty.nothingAction"),
    action: "retry",
  };
}

const EMPTY_ACTION_KEY = {
  search: "empty.clearSearch",
  filters: "empty.clearFilters",
  // one word for two retries: the line above the button says what failed
  retry: "common.retry",
  retryAsk: "common.retry",
  socialOnly: "empty.closeFilter",
  debutOnly: "empty.closeFilter",
} as const;

export const emptyActionLabel = (action: EmptyAction): string =>
  tr(EMPTY_ACTION_KEY[action]);
