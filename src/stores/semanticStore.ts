// src/stores/semanticStore.ts - state for the enhanced search, sentence and picture.
import { tr } from '../i18n'
import { batch, createEffect, createMemo, createRoot, createSignal, on, untrack } from 'solid-js'
import {
  askPicture, askSettings, PICTURE_TIMEOUT_MS, searchConfigured, SEARCH_TIMEOUT_MS,
  type PictureResult, type SemanticResult,
} from '../data/searchApi'
import { routeFor, shouldAskText, type Route } from '../model/queryRoute'
// Static, not lazy: splitting this off the entry bought a 366 B chunk plus one more request
// ahead of it, during the moment the reader waits to see their own picture. The HEIF parser
// stays lazy, in a worker file that only a HEIC loads.
import { prepare } from '../data/pictureInput'
import { searchText } from './filterStore'
// Re-exported so components do not depend on where the address comes from.
export { searchConfigured } from '../data/searchApi'
import { semanticSearch } from './displayStore'

/** A request that can be called off. The controller and its timeout belong to each other: a
 *  timeout left behind fires at an abort that already happened. */
type Wait = {
  begin(timeoutMs: number): AbortController
  owns(ctrl: AbortController): boolean
  finish(ctrl: AbortController): void
  drop(): void
}

function makeWait(): Wait {
  let current: { ctrl: AbortController; timer: ReturnType<typeof setTimeout> } | null = null
  return {
    begin(timeoutMs) {
      const ctrl = new AbortController()
      current = { ctrl, timer: setTimeout(() => ctrl.abort(), timeoutMs) }
      return ctrl
    },
    owns: (ctrl) => current?.ctrl === ctrl,
    finish(ctrl) {
      if (current?.ctrl !== ctrl) return
      clearTimeout(current.timer)
      current = null
    },
    drop() {
      if (!current) return
      current.ctrl.abort()
      clearTimeout(current.timer)
      current = null
    },
  }
}

/** Choosing a picture starts the search, so there is no "waiting to be sent" state. `preparing`
 *  (the reader's own device is re-encoding) and `none` (nothing similar) stay apart from
 *  `failed`, which would claim the search broke. `staged` - a picture up with nothing running -
 *  needs a wait dropped mid-flight, which no control can cause: the only `open()` left is
 *  hidden while the mode is on. */
export type PictureState =
  'empty' | 'preparing' | 'staged' | 'searching' | 'busy' | 'failed' | 'none' | 'done'

/** Past this fraction of both edges the box is the picture. Drawing it would put the frame on the
 *  preview's own rounded corners, where it looks like a broken overlay. A box over one edge is a
 *  band, and a band is worth drawing. */
const BOX_IS_THE_PICTURE = 0.9

// This store is global on purpose - one search box per app - so its memos and its effect are
// created in a root, the same way derivedStore wraps its own.
const store = createRoot(() => {
  // ---------- the sentence ----------

  const [pending, setPending] = createSignal(false)
  /** The answer carries the sentence it answers, so a slow reply is never applied to a newer
   *  one. */
  const [sentenceAnswer, setSentenceAnswer] =
    createSignal<(SemanticResult & { query: string }) | null>(null)
  const sentenceWait = makeWait()

  /** The last request's sentence, and whether it came back with nothing. A service that
   *  answered and found nothing is a normal empty answer, so that is not a failure. */
  const [asked, setAsked] = createSignal('')
  const [askFailed, setAskFailed] = createSignal(false)
  const [retryNonce, setRetryNonce] = createSignal(0)

  /** Call off the sentence in flight. A reply that lands late can only be applied to the
   *  wrong sentence. */
  function cancelSentence(): void {
    sentenceWait.drop()
    setPending(false)
  }

  /** Whether the reader's switch is on, and only for a build that was given an address. */
  const semanticOn = createMemo(() => semanticSearch() && searchConfigured)

  /** The hint in the search box. When the enhanced search is on, the hint is a sample query
   *  that the reader can type as it is. */
  const searchPlaceholder = createMemo(() =>
    semanticOn() ? tr('search.placeholderEnhanced') : tr('search.placeholder'))

  // ---------- the picture ----------

  /** The picture half of the enhanced search. Opening it is not a filter: the search box, the
   *  tabs and the sort buttons give way to one thumbnail. */
  function makePictureSearch() {
    const [modeOn, setModeOn] = createSignal(false)
    const [staged, setStaged] = createSignal<{ blob: Blob; url: string } | null>(null)
    // The answer for the picture that is up now: the panel reads its box, its reason and its
    // retry button. The list reads `lastShownIds` below, which can hold an earlier picture's answer.
    const [answer, setAnswer] = createSignal<PictureResult | null>(null)
    const [waiting, setWaiting] = createSignal(false)
    // The ids the list shows. A new picture does not clear them: the list would otherwise
    // drop to the plain matches while the second search runs, and a failed upload would
    // clear the first answer too. 退出 picture mode clears them, so the next session starts
    // from the plain list. A complete answer replaces them, even one that is empty; a
    // refusal, a busy service or a timeout keeps the ids already there.
    const [lastShownIds, setLastShownIds] = createSignal<number[] | null>(null)
    // The reader's own device is re-encoding the picture, before any request exists.
    const [preparing, setPreparing] = createSignal(false)
    // Which half of 查找中: the upload over the reader's network, then the search on the server.
    const [uploading, setUploading] = createSignal(false)
    const wait = makeWait()
    // A number per chosen picture, dropped along with it. Encoding is slow enough that a job
    // can finish after a second choice, or after 退出, has taken the slot.
    let stagedTurn = 0

    const stop = () => batch(() => {
      wait.drop()
      setWaiting(false)
      setUploading(false)
    })

    /** Revokes the previous preview's object URL: nothing else holds a reference to it. */
    const release = () => {
      stagedTurn += 1
      setPreparing(false)
      // The staged picture is the one to release. `release` runs from a tap, from an async
      // continuation, and from an effect, and it means the same thing in all three.
      const previous = untrack(staged)
      if (previous) URL.revokeObjectURL(previous.url)
      setStaged(null)
    }

    /** Ask with a picture - the one on screen by default, which is what the retry button
     *  needs. */
    function search(chosen: { blob: Blob; url: string } | null = staged()): void {
      if (!chosen || waiting()) return
      stop()
      const ctrl = wait.begin(PICTURE_TIMEOUT_MS)
      setWaiting(true)
      setAnswer(null)
      setUploading(true)
      void askPicture(chosen.blob, ctrl.signal, () => setUploading(false)).then((result) => {
        // Only the request still running may report; a retired one's answer would overwrite
        // a newer result.
        if (!wait.owns(ctrl)) return
        wait.finish(ctrl)
        batch(() => {
          setWaiting(false)
          setUploading(false)
          // The browser only reports that the request stopped; the timeout is the only cause.
          setAnswer(result ?? { ids: [], box: null, error: 'timeout', action: 'retry' })
          if (result && !result.error && !result.busy) setLastShownIds(result.ids)
        })
      })
    }

    const state = createMemo<PictureState>(() => {
      if (waiting()) return 'searching'
      const found = answer()
      if (found?.busy) return 'busy'
      if (found?.error) return 'failed'
      if (found?.ids.length) return 'done'
      // An empty list with no reason is a complete answer, not a failure.
      if (found) return 'none'
      if (preparing()) return 'preparing'
      // However the wait ended, the reader's picture stays up rather than reverting to the
      // drop zone.
      return staged() ? 'staged' : 'empty'
    })

    /** A picture that is up, or one that has answered, is the question for the service: it holds
     *  the one upload slot. An open drop zone with no picture in it holds nothing, so the sentence
     *  in the box stays the question. */
    const holds = createMemo(() => state() !== 'empty')

    return {
      on: modeOn,
      answer,
      /** The preview, made from the picture the reader chose; once the encode lands it is the
       *  same picture that gets sent. */
      preview: () => staged()?.url ?? '',
      uploading,

      open() {
        batch(() => {
          setModeOn(true)
          stop()
        })
      },

      /** Leaving picture mode also drops the ranking: keeping it would hide the sort buttons
       *  for a reason nobody could see. */
      close() {
        batch(() => {
          setModeOn(false)
          stop()
          setAnswer(null)
          setLastShownIds(null)
        })
        release()
      },

      /** Show a chosen picture and search with it right away. Replaces the picture that was
       *  up and releases its object URL. */
      async stage(file: Blob): Promise<void> {
        // The reader's own file goes on screen in the task that handled the tap, before a
        // single byte is re-encoded. On a phone the encode runs long enough that a drop zone
        // still sitting there reads as a dead button.
        release()
        // A request still running for the previous picture is called off rather than left to
        // finish: `search` below will not start while one is running, so the reader would see
        // this picture wearing the other one's results and these bytes would never go out.
        stop()
        const turn = stagedTurn
        setStaged({ blob: file, url: URL.createObjectURL(file) })
        setAnswer(null)
        setPreparing(true)

        const found = await prepare(file)
        // A newer picture, or 退出, took the slot while this one was encoding.
        if (turn !== stagedTurn) return
        if (!found.blob) {
          // The browser could not read it: a HEIC with no platform HEVC decoder, a truncated
          // file. Nothing left the device, so the service never got to say: use another picture.
          batch(() => {
            release()
            setAnswer({ ids: [], box: null, error: found.reason, action: 'pick' })
          })
          return
        }
        // From here the preview is the same picture that goes out: white ground, at most
        // 768px, orientation baked in rather than promised.
        batch(() => {
          release()
          setStaged({ blob: found.blob, url: URL.createObjectURL(found.blob) })
        })
        search()
      },

      search,

      state,
      holds,

      /** Where the subject sat, as fractions of the staged picture: left, top, width, height.
       *  Null when there is nothing to draw. */
      box: createMemo<[number, number, number, number] | null>(() => {
        const found = answer()?.box ?? null
        if (!found) return null
        return found[2] >= BOX_IS_THE_PICTURE && found[3] >= BOX_IS_THE_PICTURE
          ? null
          : found
      }),

      /** Why the last picture came back with nothing. Empty when there was an answer. */
      error: () => answer()?.error ?? '',

      /** What the reader can do next. Empty means no button: the service names it for its own
       *  refusals, this file for the browser's. */
      action: () => answer()?.action ?? '',

      /** The ids the list is showing, or null while it still shows its plain matches. */
      lastShownIds,
    }
  }

  const picture = makePictureSearch()

  // The switch covers both ways to ask, so turning it off closes the picture. The circle that
  // opened it hides with the switch, so an open drop zone would have no way out. The list would
  // also keep a picture's order after the reader turned the search off.
  createEffect(on(semanticOn, (on) => { if (!on) picture.close() }, { defer: true }))

  // ---------- what the list reads ----------

  /** An answer to an older sentence must not rank a newer one, hence the query check. */
  const sentenceIds = createMemo<number[]>(() => {
    const found = sentenceAnswer()
    return found && found.query === searchText().trim() ? found.ids : []
  })

  /** Which route the list follows. The toolbar and the grid both read it, so they cannot
   *  disagree about the sort buttons while a ranking is on screen. */
  const route = createMemo<Route>(() => routeFor({
    pictureOn: picture.on(),
    pictureIds: picture.lastShownIds(),
    semanticOn: semanticOn(),
    query: searchText().trim(),
    textIds: sentenceIds(),
  }))

  /** Whether a model ranking orders the list. */
  const semanticActive = createMemo(() => route().by !== 'none')

  /** The rows on screen are a photograph's answer. An answer of "nothing" counts too, because the
   *  emptiness came from the picture. With no answer yet, the list is the reader's own text
   *  search, and the tab filters it. */
  const pictureAnswers = createMemo(() => route().by === 'picture')

  // ---------- the question the box asks ----------

  // picture.holds is a dependency so that dropping a picture re-asks the sentence still in the
  // box. retryNonce is there for the reader who taps 重试 on the sentence already in the box.
  createEffect(on([searchText, picture.holds, semanticOn, retryNonce], ([typed]) => {
    cancelSentence()
    const q = typed.trim()
    if (!shouldAskText({ pictureHolds: picture.holds(), semanticOn: semanticOn(), query: q })) return
    // A stalled request must not freeze the list: the timeout aborts it, local matches stay.
    const ctrl = sentenceWait.begin(SEARCH_TIMEOUT_MS)
    setAsked(q)
    setAskFailed(false)
    setPending(true)
    void askSettings(q, ctrl.signal).then((result) => {
      if (result && !ctrl.signal.aborted) setSentenceAnswer({ ...result, query: q })
      if (sentenceWait.owns(ctrl)) batch(() => {
        sentenceWait.finish(ctrl)
        setAskFailed(!result || ctrl.signal.aborted)
        setPending(false)
      })
    })
  }))

  /** An older sentence's failure says nothing about the search now in the box. */
  const askFailure = createMemo(() => asked() === searchText().trim() && askFailed())

  /** Bump to ask about the sentence already in the box. */
  const retryAsk = () => setRetryNonce((n) => n + 1)

  return {
    pending, semanticOn, searchPlaceholder, picture, semanticActive, pictureAnswers, route,
    askFailure, retryAsk,
  }
})

export const {
  semanticOn, searchPlaceholder, semanticActive, pictureAnswers, route, picture, askFailure,
  retryAsk,
} = store
const { pending } = store
export { pending as semanticPending }

/** What the picture's answer means for a list that came back empty.
 *
 * `busy` sits with `working` because the service reports that it is busy, so a verdict there
 * would be a guess about a reply still on its way. `done` and `empty` mean the picture's answer
 * is not why the list is empty. The switch covers every state, so a new one fails to compile
 * here.
 */
export function pictureMeaning(): 'working' | 'failed' | 'noMatch' | 'nothing' {
  switch (picture.state()) {
    case 'preparing':
    case 'staged':
    case 'searching':
    case 'busy':
      return 'working'
    case 'failed':
      return 'failed'
    case 'none':
      return 'noMatch'
    case 'empty':
    case 'done':
      return 'nothing'
  }
}
