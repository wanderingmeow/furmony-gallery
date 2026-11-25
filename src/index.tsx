/* @refresh reload */
import { render } from "solid-js/web";

// The dev server has no sheet to link, so both arrive here as modules. The address is computed and
// the import is left to the browser, because an import the build can see would attach the file to
// the entry as a stylesheet of its own - and the document carries boot.css and nothing else.
if (import.meta.env.DEV) {
  for (const sheet of ["./boot.css", "./index.css"])
    void import(/* @vite-ignore */ sheet);
}
import App from "./App.tsx";
import { watchAppSheet } from "./draw/appSheet";
import { holdPinch } from "./draw/pinchLock";
import { registerServiceWorker } from "./draw/serviceWorker";

// iOS reads a double tap as a zoom request, and the gesture lands between two taps on a card.
document.ondblclick = (e) => e.preventDefault();
holdPinch();

// the app restores its own row, so Safari must not restore one on a history step
history.scrollRestoration = "manual";

// the mount does not wait for the sheet, so the listing request starts beside that download
watchAppSheet();
render(() => <App />, document.getElementById("root")!);

// The first paint does not wait for a worker, so this runs after the mount and nothing reads a result.
registerServiceWorker();

// Rollup keeps a file separate only when something imports it dynamically. Starting the detail
// body here means it downloads beside the first screen, so a card opens with no wait. Stats
// stays behind a real tap: a user who never opens the statistics screen never needs charts.
void import("./routes/Detail");
