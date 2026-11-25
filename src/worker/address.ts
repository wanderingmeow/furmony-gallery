// The three addresses a deploy under a sub-path derives from the worker's own location, so no
// constant here needs changing when the path changes.

// The worker's scope, and the one key every route's document is stored under.
export const root = new URL("./", self.location.href).href;

// The card's picture. The name is relative to the worker's own address, so the app's subpath is
// already in it.
export const ICON = new URL("icon-192.png", self.location.href).href;

// The list of files to keep, which the build writes beside this worker.
export const listFile = new URL("precache.json", self.location.href).href;
