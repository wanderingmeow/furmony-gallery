/**
 * The document's script and api.ts build their list requests from here.
 *
 * The document hands its answer to the app under a key, and the app checks the shape of the answer
 * and nothing about which list it came from. An address that points at the wrong list would deliver
 * the wrong rows under the right name.
 */
export const ENDPOINT_URL = {
  primary: "https://apo.furmony.com/adopt/HarmonyAdopt/entrustAdopt/list",
  // `series` is the site's 「新作登场」 list: new art styles.
  series: "https://apo.furmony.com/adopt/HarmonyAdopt/productSeries/list",
} as const;

export type Endpoint = keyof typeof ENDPOINT_URL;

/** Without `pageSize` the answer carries only 10 rows and the total. */
export function pageUrl(
  endpoint: Endpoint,
  pageSize?: number,
  pageNum = 1,
): string {
  const qs = new URLSearchParams({ pageNum: String(pageNum) });
  if (pageSize !== undefined) qs.set("pageSize", String(pageSize));
  return `${ENDPOINT_URL[endpoint]}?${qs}`;
}

/**
 * The number sits above the size of the whole shelf, so one request returns the whole list.
 */
export const LIST_PAGE_SIZE = 2000;

/**
 * What the document's own chain is filed under, one per list.
 *
 * The chain lives in memory only, and the app joins a download that is already running, so it needs
 * a name to look it up by. Matching addresses would matter to a cache, and this API sends no
 * headers that let one form.
 */
export const listKey = (endpoint: Endpoint): string =>
  `furmony:list:${endpoint}`;

/** The part of every list request that is the same for every language. */
export const LIST_REQUEST_BASE = { referrerPolicy: "no-referrer" } as const;

/**
 * The request that every list fetch makes. The document runs it before the app exists, and api.ts,
 * the generated script and the tests all take it from here, so the three change together.
 *
 * `Target-Language` decides the language of the names and descriptions in the answer. The site
 * accepts four codes and no ordinary language tag: `src/i18n/apiLanguage.ts` holds them and says
 * what the ordinary tags get back.
 */
export const listRequestInit = (targetLanguage: string) => ({
  ...LIST_REQUEST_BASE,
  headers: { "Target-Language": targetLanguage },
});
