/**
 * The document's own watchdog: the failures that would otherwise leave the spinner turning.
 *
 * It ships as text that vite.config.ts writes into the document, because what it reports on is code
 * that has not arrived yet - a chunk or a stylesheet the document names and the server no longer
 * has. A listener installed by the app cannot hear a failure that happened before the app existed,
 * and a stale document is exactly when that happens.
 *
 * The lines are what the browser said, word for word: an exception message with its file and line,
 * or the address of the file that did not arrive. Nothing here is a translation of that.
 */
export function bootWatchScript(): string {
  return `(() => {
  const notes = []
  let box = null
  // One reload per visit, remembered under the key draw/appSheet uses for the same recovery: a
  // document that names a file the server no longer has is a document from before the last deploy,
  // and reloading asks for one that names the file that exists.
  const RELOAD = 'furmony:sheet-reloaded'
  const reloadOnce = () => {
    try {
      if (sessionStorage.getItem(RELOAD)) return false
      sessionStorage.setItem(RELOAD, '1')
      location.reload()
      return true
    } catch {
      // Private mode can refuse storage, and a reload nobody remembers is the first lap of a loop.
      return false
    }
  }
  // An error from a file that is not ours says nothing about this boot. A browser extension throws
  // at document_start and flashes under the spinner on every reload; the browser redacts a
  // cross-origin script to "Script error." with no file and no line, which is nothing to read.
  const ours = (u) => {
    try {
      return !!u && new URL(u, location.href).origin === location.origin
    } catch {
      return false
    }
  }
  // A rejection carries its file inside the text, so the same question is asked of the first address
  // it names.
  const ourText = (t) => {
    const at = String(t).indexOf('://')
    return at < 0 || ours('//' + String(t).slice(at + 3).split(/[ /?#]/)[0])
  }
  const line = (text) => {
    const p = document.createElement('p')
    p.className = 'boot-error-line'
    p.textContent = text
    return p
  }
  const paint = () => {
    const spinner = document.getElementById('boot-spinner')
    // The spinner is the boot. Once the app paints, the app's own dialog reports the failure.
    if (!spinner) return
    // A ring that keeps turning says work is happening, and nothing is.
    spinner.setAttribute('data-failed', '')
    if (!box) {
      box = document.createElement('div')
      box.id = 'boot-error'
      ;(document.body || document.documentElement).append(box)
    }
    box.prepend(...notes.splice(0).map(line))
  }
  const note = (text) => {
    if (!text || notes.includes(text)) return
    notes.push(text)
    paint()
  }
  // capture, because a resource that failed to arrive does not bubble
  window.addEventListener('error', (e) => {
    const tag = e.target
    if (tag instanceof HTMLLinkElement || tag instanceof HTMLScriptElement) {
      // A file the document names and the server does not have: try the document again before
      // telling anyone, because the second document usually names a file that exists.
      if (reloadOnce()) return
      note('error: ' + tag.tagName + ' ' + (tag.href || tag.src))
    } else if (e.message && ours(e.filename)) {
      note(e.message + ' (' + e.filename + ':' + e.lineno + ':' + e.colno + ')')
    }
  }, true)
  window.addEventListener('unhandledrejection', (e) => {
    const why = e.reason
    const text = String((why && (why.stack || why.message)) || why)
    if (ourText(text)) note(text)
  })
})()`;
}
