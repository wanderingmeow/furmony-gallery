/**
 * The document's script and api.ts build their list requests from here.
 *
 * The document hands its answer to the app under a key, and the app checks the shape of the answer
 * and nothing about which list it came from. An address that points at the wrong list would deliver
 * the wrong rows under the right name.
 */
export const ENDPOINT_URL = {
  primary: 'https://apo.furmony.com/adopt/HarmonyAdopt/entrustAdopt/list',
  // `series` is the site's 「新作登场」 list: new art styles.
  series: 'https://apo.furmony.com/adopt/HarmonyAdopt/productSeries/list',
} as const

export type Endpoint = keyof typeof ENDPOINT_URL

/** Without `pageSize` the answer carries only 10 rows and the total. */
export function pageUrl(endpoint: Endpoint, pageSize?: number, pageNum = 1): string {
  const qs = new URLSearchParams({ pageNum: String(pageNum) })
  if (pageSize !== undefined) qs.set('pageSize', String(pageSize))
  return `${ENDPOINT_URL[endpoint]}?${qs}`
}

/**
 * What the document's own chain is filed under, one per list.
 *
 * The chain lives in memory only, and the app joins a download that is already running, so it needs
 * a name to look it up by. Matching addresses would matter to a cache, and this API sends no
 * headers that let one form.
 */
export const listKey = (endpoint: Endpoint): string => `furmony:list:${endpoint}`

/**
 * The request every list read makes.
 *
 * The document runs it before the app exists. api.ts, the generated script and the test all read
 * this object, so a header added on one side is not missing on the others.
 */
export const LIST_REQUEST_INIT = { referrerPolicy: 'no-referrer' } as const
