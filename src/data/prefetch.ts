// These import specifiers carry the `.ts` extension on purpose. vite.config.ts imports this file
// and type checks it under Node's own resolution rules, which require one.
import {
  ENDPOINT_URL,
  LIST_PAGE_SIZE,
  LIST_REQUEST_BASE,
  listKey,
  pageUrl,
  type Endpoint,
} from "./endpoints.ts";
import {
  API_LANGUAGE,
  DETECT_LOCALE_SCRIPT,
  LOCALE_KEY,
} from "../i18n/apiLanguage.ts";

declare global {
  interface Window {
    /** Answers the document started downloading before the app existed, one per list key. */
    __furmonyPrefetch?: Record<string, Promise<unknown> | undefined>;
  }
}

/**
 * The language of the first list, worked out before the app exists. A stored choice wins, and a
 * browser tag decides on a first visit. This is the rule the app itself runs, and the two have to
 * agree: a first list in one language and a retry in another would show two different sets of names.
 */
const languageScript = (): string => {
  const codes = JSON.stringify(API_LANGUAGE);
  const stored = `(()=>{try{return localStorage.getItem(${JSON.stringify(LOCALE_KEY)})}catch(e){return null}})()`;
  return `const LANG=${codes}[${stored}]||${codes}[(${DETECT_LOCALE_SCRIPT})(navigator.language)];`;
};

/**
 * The list requests, as code the document can run before the app exists. The answers come back from
 * the API host while these scripts are still crossing from github.io.
 *
 * Each request beyond the first is another chance for the WAF in front of the site to get between
 * the app and the API and return a page of its own.
 *
 * The promise is stored while it is still running, so an app that arrives early waits on the
 * download that already started. A body is read here because a response can only be read once, and
 * any failure answers `null`, which the app reads as no prefetch at all.
 */
export function prefetchScript(): string {
  const lists = (Object.keys(ENDPOINT_URL) as Endpoint[]).map((endpoint) => {
    const start = JSON.stringify(pageUrl(endpoint, LIST_PAGE_SIZE));
    return `${JSON.stringify(listKey(endpoint))}:ask(${start})`;
  });
  // The API can report a failure in the body of a response that is ok. The script treats that as a
  // failure too, so the app makes the request itself and retries on its own schedule.
  const ask =
    `${languageScript()}` +
    `const INIT={...${JSON.stringify(LIST_REQUEST_BASE)},headers:{"Target-Language":LANG}};` +
    `const ask=(u)=>fetch(u,INIT)` +
    ".then((r)=>(r.ok?r.json():null)).catch(()=>null)" +
    ".then((d)=>(d&&d.code===200?d:null));";
  return `${ask}window.__furmonyPrefetch={${lists.join(",")}};`;
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
  const stashed = window.__furmonyPrefetch?.[key];
  if (stashed) delete window.__furmonyPrefetch![key];
  return stashed;
}
