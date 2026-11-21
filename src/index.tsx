/* @refresh reload */
import { render } from 'solid-js/web'

// The dev server has no sheet to link, so both arrive here as modules. The address is computed and
// the import is left to the browser, because an import the build can see would attach the file to
// the entry as a stylesheet of its own - and the document carries boot.css and nothing else.
if (import.meta.env.DEV) {
  for (const sheet of ['./boot.css', './index.css']) void import(/* @vite-ignore */ sheet)
}
import App from './App.tsx'
import { watchAppSheet } from './draw/appSheet'

// Disable iOS Safari Double-Tap to Zoom
document.ondblclick = (e) => e.preventDefault()

// the app restores its own row, so Safari must not restore one on a history step
history.scrollRestoration = 'manual'

// The spinner in index.html sits outside #root, so render() cannot clear it. Home removes it
// once the screen has something to show.

// the mount does not wait for the sheet, so the listing request starts beside that download
watchAppSheet()
render(() => <App />, document.getElementById('root')!)

// Dynamic, so a normal visit never downloads it.

// Rollup keeps a file separate only when something imports it dynamically. Starting the detail
// body here means it downloads beside the first screen, so a card opens with no wait. Stats
// stays behind a real tap: a user who never opens the statistics screen never needs charts.
void import('./routes/Detail')
