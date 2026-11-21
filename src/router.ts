// The router base and every address the app navigates to, so the routes and the navigations cannot
// drift apart.
//
// The base shows up twice, in opposite directions. An address passed to `navigate` is relative to
// the base, so the helpers leave it off. `useMatch` compares against `location.pathname` as the
// browser sees it, so the patterns carry the base.

// No trailing slash: a base that ends in '/' turns /detail into `//detail`.
const base = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** The value for `<Router base>`. */
export const routerBase = base;

/** The list screen. The filters live in the store, so the address carries nothing beyond the base. */
export const homePath = (): string => "/";

export const statsPath = (): string => "/stats";

export const detailPath = (id: number): string => `/detail/${id}`;

// The route patterns, for the `<Route>` elements. Those routes are no-ops: they keep the URL, deep
// links and the back button working, while Shell reads the path and decides which sheet is open.
export const indexRoute = "/";
export const detailRoute = "/detail/:id";
export const statsRoute = "/stats";

/** Patterns for `useMatch`. */
export const detailPattern = `${base}/detail/:id`;
export const statsPattern = `${base}/stats`;
