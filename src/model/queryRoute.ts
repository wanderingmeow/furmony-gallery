// src/model/queryRoute.ts - which route the list follows, and what is worth asking the model.
//
// The toolbar, the grid and the request all read these answers, so the rules live in one
// file: a picture outranks the sentence still in the box, a bare number belongs to the local
// search, and an empty answer is still an answer.

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

/** A picture holds the service's one upload slot, so picture mode takes the question. */
export function shouldAskText(i: {
  pictureOn: boolean
  semanticOn: boolean
  query: string
}): boolean {
  return !i.pictureOn && i.semanticOn && worthAsking(i.query)
}

export function routeFor(i: RouteInput): Route {
  if (i.pictureOn) {
    // An empty answer is still the picture's answer, so the list follows it and goes empty.
    // While nothing has answered, the plain list stays.
    return i.pictureIds === null ? { by: 'none' } : { by: 'picture', ids: i.pictureIds }
  }
  return shouldAskText(i) ? { by: 'text', ids: i.textIds } : { by: 'none' }
}
