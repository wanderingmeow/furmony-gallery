// src/stores/semanticStore.ts - state for the Beta search, sentence and picture.
import { batch, createEffect, createMemo, createRoot, createSignal, on } from 'solid-js'
import {
  askPicture, askSettings, PICTURE_TIMEOUT_MS, searchConfigured, SEARCH_TIMEOUT_MS,
  worthAsking, type PictureResult, type SemanticResult,
} from '../data/searchApi'
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

/** There is no "waiting to be sent" state: choosing a picture starts the search. `staged`
 *  (nothing running) and `none` (nothing similar) stay apart because the reader is told
 *  different things; either one called `failed` would claim the search broke. */
export type PictureState = 'empty' | 'staged' | 'searching' | 'busy' | 'failed' | 'none' | 'done'

/** Fraction of the picture's edge (0–1) past which the cut-out box is not drawn: at that
 *  width it lands on the preview's own rounded corner and reads as a broken overlay. The box
 *  exists for a hall photo whose background the mask cuts away. */
const BOX_EDGE_WORTH_DRAWING = 0.9

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

  /** Call off the sentence in flight. A reply that lands late can only be applied to the
   *  wrong sentence. */
  function cancelSentence(): void {
    sentenceWait.drop()
    setPending(false)
  }

  /** Whether the reader's switch is on, and only for a build that was given an address. */
  const semanticOn = createMemo(() => semanticSearch() && searchConfigured)

  /** The box's hint: a sentence about the piece rather than a name, once the search is on. */
  const searchPlaceholder = createMemo(() =>
    semanticOn() ? '描述设定，比如「黑绿色的龙，不带翅膀」' : '搜索名称/描述/ID')

  // ---------- the picture ----------

  /** The picture half of the Beta search. Opening it is not a filter: the search box, the
   *  tabs and the sort buttons give way to one thumbnail. */
  function makePictureSearch() {
    const [modeOn, setModeOn] = createSignal(false)
    const [staged, setStaged] = createSignal<{ blob: Blob; url: string } | null>(null)
    const [answer, setAnswer] = createSignal<PictureResult | null>(null)
    const [waiting, setWaiting] = createSignal(false)
    // Which half of 查找中: the upload over the reader's network, then the search on the server.
    const [uploading, setUploading] = createSignal(false)
    const wait = makeWait()

    const stop = () => batch(() => {
      wait.drop()
      setWaiting(false)
      setUploading(false)
    })

    /** Revokes the previous preview's object URL: nothing else holds a reference to it. */
    const release = () => {
      const previous = staged()
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
        })
      })
    }

    return {
      on: modeOn,
      answer,
      /** The preview, made from the same bytes that get sent. */
      preview: () => staged()?.url ?? '',
      uploading,

      open() {
        batch(() => {
          setModeOn(true)
          // The box is hidden, so the sentence is no longer the question; this also frees the
          // service's one upload slot, which the picture needs.
          cancelSentence()
          stop()
        })
      },

      /** Leaving picture mode also drops the ranking: keeping it would hide the sort buttons
       *  for a reason nobody could see. */
      close() {
        batch(() => {
          setModeOn(false)
          cancelSentence()
          stop()
          setAnswer(null)
        })
        release()
      },

      /** Show a chosen picture and search with it right away. Replaces the picture that was up
       *  and releases its object URL. */
      async stage(file: Blob): Promise<void> {
        const prepared = await prepare(file)
        if (!prepared) {
          // The browser could not decode it (a HEIC, a truncated file). Nothing left the
          // device, so the service never got to say: use another picture.
          setAnswer({ ids: [], box: null, error: 'unreadable', action: 'pick' })
          return
        }
        release()
        setStaged({ blob: prepared, url: URL.createObjectURL(prepared) })
        setAnswer(null)
        search()
      },

      search,

      state: createMemo<PictureState>(() => {
        if (waiting()) return 'searching'
        const found = answer()
        if (found?.busy) return 'busy'
        if (found?.error) return 'failed'
        if (found?.ids.length) return 'done'
        // An empty list with no reason is a complete answer, not a failure.
        if (found) return 'none'
        // However the wait ended, the reader's picture stays up rather than reverting to the
        // drop zone.
        return staged() ? 'staged' : 'empty'
      }),

      /** Where the subject sat, as fractions of the staged picture: left, top, width, height.
       *  Null when there is nothing to draw. */
      box: createMemo<[number, number, number, number] | null>(() => {
        const found = answer()?.box ?? null
        if (!found) return null
        return found[2] >= BOX_EDGE_WORTH_DRAWING
          || found[3] >= BOX_EDGE_WORTH_DRAWING ? null : found
      }),

      /** Why the last picture came back with nothing. Empty when there was an answer. */
      error: () => answer()?.error ?? '',

      /** What the reader can do next. Empty means no button: the service names it for its own
       *  refusals, this file for the browser's. */
      action: () => answer()?.action ?? '',

      /** Whether the list is ranked by the picture. Nothing on the site matches a photograph
       *  by text, so there is no exact-match group in front of it. */
      ranked: createMemo(() => !!answer()?.ids.length),
    }
  }

  const picture = makePictureSearch()

  // ---------- what the list reads ----------

  /** The toolbar and the list read this one test, so they cannot disagree about the sort
   *  buttons. */
  const semanticActive = createMemo(() => picture.ranked()
    || (semanticOn() && worthAsking(searchText().trim())))

  /** The ids the list ranks by. An answer to an older sentence must not rank a newer one,
   *  hence the query check. */
  const semanticIds = createMemo<number[]>(() => {
    if (picture.ranked()) return picture.answer()?.ids ?? []
    if (!semanticOn()) return []
    const found = sentenceAnswer()
    return found && found.query === searchText().trim() ? found.ids : []
  })

  // ---------- the question the box asks ----------

  // picture.on is a dependency so that leaving the mode re-asks the sentence still in the box.
  createEffect(on([searchText, picture.on, semanticOn], ([typed]) => {
    cancelSentence()
    const q = typed.trim()
    if (picture.on() || !semanticOn() || !worthAsking(q)) return
    // A stalled request must not freeze the list: the timeout aborts it, local matches stay.
    const ctrl = sentenceWait.begin(SEARCH_TIMEOUT_MS)
    setPending(true)
    void askSettings(q, ctrl.signal).then((result) => {
      if (result && !ctrl.signal.aborted) setSentenceAnswer({ ...result, query: q })
      if (sentenceWait.owns(ctrl)) batch(() => {
        sentenceWait.finish(ctrl)
        setPending(false)
      })
    })
  }))

  return { pending, semanticOn, searchPlaceholder, picture, semanticActive, semanticIds }
})

export const { semanticOn, searchPlaceholder, semanticActive, semanticIds, picture } = store
const { pending } = store
export { pending as semanticPending }
