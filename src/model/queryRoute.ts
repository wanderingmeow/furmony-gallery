// src/model/queryRoute.ts - which route the list follows, and what is worth asking the model.
//
// The toolbar, the grid and the request all read these answers, so the rules live in one file: a
// picture comes before the sentence in the box, a bare number is what the local search matches,
// and a picture's answer of "nothing" still counts as an answer.

/** Digits and nothing but separators: `12 34`, `1234,5678`. A pile of numbers gives the model
 *  nothing to rank. */
const ONLY_NUMBERS = /^[\d\s,，、/.；;.-]+$/

/** The local search matches an adoptId exactly, so a bare number is its job. Length counts
 *  code points, not UTF-16 units. */
export function worthAsking(query: string): boolean {
  const q = query.trim()
  return Array.from(q).length >= 3 && !ONLY_NUMBERS.test(q)
}

export type Route =
  /** A photograph is the whole question: no exact-match group stands in front of its answer. */
  | { by: 'picture'; ids: number[] }
  /** Exact matches first, the model's neighbors after them. */
  | { by: 'text'; ids: number[] }
  /** The plain list, in the order the reader chose. */
  | { by: 'none' }

export interface RouteInput {
  pictureOn: boolean
  /** What the picture route last answered with, or null while no picture has answered. */
  pictureIds: number[] | null
  semanticOn: boolean
  query: string
  /** An answer to that exact sentence, empty when there is none. */
  textIds: number[]
}

function boxHoldsQuestion(i: { semanticOn: boolean; query: string }): boolean {
  return i.semanticOn && worthAsking(i.query)
}

/** A picture that is up has the service's one upload slot, so it has the question. An open drop
 *  zone with no picture has nothing, which leaves the sentence in the box as the question. */
export function shouldAskText(i: {
  pictureHolds: boolean
  semanticOn: boolean
  query: string
}): boolean {
  return !i.pictureHolds && boxHoldsQuestion(i)
}

export function routeFor(i: RouteInput): Route {
  // A picture's answer of nothing still rules: the list stays empty. The sentence's results stand
  // only while no picture has answered, because the local search cannot match a sentence.
  if (i.pictureOn && i.pictureIds !== null) return { by: 'picture', ids: i.pictureIds }
  return boxHoldsQuestion(i) ? { by: 'text', ids: i.textIds } : { by: 'none' }
}
