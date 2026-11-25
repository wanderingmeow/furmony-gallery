// A worker's scope cannot reach above its own directory, and `BASE_URL` is `/furmony-gallery` with no
// trailing slash: joined to the origin as-is it names a file, so the scope falls to the domain root.
export function serviceWorkerAddress(
  base: string,
  origin: string,
): { url: string; scope: string } {
  const root = new URL(`${base.replace(/\/+$/, "")}/`, origin);
  return { url: new URL("sw.js", root).href, scope: root.href };
}

/** Whether this page should have a worker.
 *
 *  Development has none: a worker there would sit between the browser and the file being edited.
 *  `?sw=1` asks for one anyway, which is the only way notifications can be tested there at all: a
 *  browser hands a subscription to a worker and to nothing else. The reader who adds it is the one
 *  accepting a file between the browser and the edit.
 */
export function wantsWorker(dev: boolean, search: string): boolean {
  return !dev || new URLSearchParams(search).has("sw");
}

/** Register once per page, and answer with the registration or with null.
 *
 *  Startup does not wait for this, so anything that needs the worker asks here as well: a second
 *  call to the same address is the same registration, not a second worker.
 */
export function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!wantsWorker(import.meta.env.DEV, location.search))
    return Promise.resolve(null);
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  const { url, scope } = serviceWorkerAddress(
    import.meta.env.BASE_URL,
    location.origin,
  );
  return (
    navigator.serviceWorker
      // `none`: the worker's own bytes are always re-checked. The default trusts the HTTP cache for
      // imports, and Pages answers a read with max-age=600.
      .register(url, { scope, updateViaCache: "none" })
      .catch(() => null)
  );
}

// When registration fails, the app loses the install entry and nothing else.
export function registerServiceWorker(): void {
  void registerWorker().then((registration) => {
    if (!registration) return;
    // An app resumed from the app switcher never navigates, so nothing re-checks sw.js. Coming
    // back to the foreground is the only signal that a deploy landed.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void registration.update();
    });
  });
}
