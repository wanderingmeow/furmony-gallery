// The extension, because vite.config.ts imports this file and type checks it under Node's own
// resolution rules, which ask for one.
import { ENDPOINT_URL, LIST_REQUEST_INIT, listKey, pageUrl, type Endpoint } from './endpoints.ts'

declare global {
  interface Window {
    /** Answers the document started downloading before the app existed, one per list key. */
    __furmonyPrefetch?: Record<string, Promise<unknown> | undefined>
  }
}

/**
 * The list requests, as code the document can run before the app exists. The answers come back from
 * the API host while these scripts are still crossing from github.io.
 *
 * The promise is stored while it is still running, so an app that arrives early waits on the
 * download that already started. A body is read here because a response can only be read once, and
 * any failure answers `null`, which the app reads as no prefetch at all.
 */
export function prefetchScript(): string {
  const lists = (Object.keys(ENDPOINT_URL) as Endpoint[]).map((endpoint) => {
    const start = JSON.stringify(pageUrl(endpoint))
    return (
      `${JSON.stringify(listKey(endpoint))}:(async()=>{const one=await ask(${start});` +
      `const n=one&&one.code===200?one.total:0;return n?await ask(${start}+"&pageSize="+n):null})()`
    )
  })
  const ask =
    `const ask=(u)=>fetch(u,${JSON.stringify(LIST_REQUEST_INIT)})` +
    '.then((r)=>(r.ok?r.json():null)).catch(()=>null);'
  return `${ask}window.__furmonyPrefetch={${lists.join(',')}};`
}

/**
 * The answer the document already started downloading for this list, or undefined when there is
 * none. The promise resolves to the list response.
 *
 * When that download is still running, the caller waits on it, and the list is not asked for a
 * second time. Reading removes the entry, so a second caller goes to the network: an answer that
 * failed should not be handed on to the next one.
 */
export function takePrefetched(key: string): Promise<unknown> | undefined {
  const stashed = window.__furmonyPrefetch?.[key]
  if (stashed) delete window.__furmonyPrefetch![key]
  return stashed
}
