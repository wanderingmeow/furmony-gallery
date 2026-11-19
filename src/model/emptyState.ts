// src/model/emptyState.ts - what to say when the list has nothing to show.
//
// An empty list used to show nothing at all, and the copyright band under the cards slid up
// under the toolbar. A reader then has to work out which of several things went wrong. These
// states say which one happened, and the button under them does the fix.

export type EmptyIcon = 'heart' | 'search' | 'filter' | 'spark' | 'warning'

/** What the picture's own answer amounts to, or null while the picture says nothing about the
 *  empty list. */
export type PictureSay = 'failed' | 'noMatch'

/** What the reader can press. The component knows what each one does. */
export type EmptyAction = 'search' | 'filters' | 'retry' | 'retryAsk' | 'socialOnly'

export interface EmptyFacts {
  loadFailed: boolean
  /** Something is still working: the enhanced search has not answered for the sentence in the
   *  box, or the picture search is still running. */
  asking: boolean
  /** The switch that keeps only the listings whose owner has an account we can link to. */
  socialOnly: boolean
  onWishlistTab: boolean
  savedCount: number
  query: string
  /** How many picks the reader made: the colors, the species, and the price range as one pick. */
  picked: number
  /** Dropping those picks would bring results back, so the picks are what emptied the list. */
  filtersAreTheCause: boolean
  /** The request about this sentence ended with nothing in hand. A service that answered and
   *  found nothing is a normal empty answer, so that is not a failure. */
  sentenceFailed: boolean
  pictureSay: PictureSay | null
}

export interface EmptyState {
  icon: EmptyIcon
  title: string
  line?: string
  action?: EmptyAction
}

/** A sentence the reader typed, shortened to fit one line of a title. */
function shortQuery(q: string): string {
  return q.length > 20 ? `${q.slice(0, 20)}…` : q
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
  if (f.asking) return null
  if (f.loadFailed) {
    return { icon: 'warning', title: '没能载入设定', line: '试过几次，还是没拿到', action: 'retry' }
  }
  if (f.socialOnly) {
    return { icon: 'filter', title: '没有查到主人账号的设定', action: 'socialOnly' }
  }
  if (f.onWishlistTab && f.savedCount === 0) {
    // The tab pills stay on screen, so this case has nothing to hand back.
    return { icon: 'heart', title: '还没有收藏' }
  }
  if (f.pictureSay) {
    return f.pictureSay === 'failed'
      ? { icon: 'spark', title: '没找到结果', line: '换一张图，或者稍后重试' }
      : { icon: 'spark', title: '没有很像的', line: '换一张图试试' }
  }
  if (f.sentenceFailed) {
    return { icon: 'spark', title: '增强搜索失败', line: '文字匹配也没有结果', action: 'retryAsk' }
  }
  if (f.query && f.filtersAreTheCause) {
    return { icon: 'filter', title: '当前筛选下没有设定', action: 'filters' }
  }
  if (f.query) {
    return { icon: 'search', title: `没有「${shortQuery(f.query)}」相关设定`, line: '换个词试试', action: 'search' }
  }
  if (f.picked) {
    return { icon: 'filter', title: '当前筛选下没有设定', action: 'filters' }
  }
  // The request succeeded and the shelf holds nothing, so a retry is the only move the reader can
  // make.
  return { icon: 'search', title: '没有可显示的设定', line: '稍后再试，或者去官网看看', action: 'retry' }
}

export const EMPTY_ACTION_LABELS: Record<EmptyAction, string> = {
  search: '清除搜索',
  filters: '清除筛选',
  // Two actions retry two different things, the data load and the enhanced search. The reader
  // sees one word either way, because the line above the button says what failed.
  retry: '重试',
  retryAsk: '重试',
  socialOnly: '关闭该筛选',
}
