import { existsSync, readFileSync, rmSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { prefetchScript } from './src/data/prefetch.ts'

function textAt(path: URL): string {
  try {
    return readFileSync(path, 'utf8').trim()
  } catch {
    return ''
  }
}

/**
 * The optional address the settings search sends a sentence to.
 *
 * It lives outside the repository, so neither a command line nor a committed file has to
 * carry it: environment first (for a machine without the local file), then the untracked
 * file next to this config. No value is a normal build - the feature stays hidden.
 */
function encodedAddress(): string {
  const encoded = process.env.VITE_SEARCH_URL_B64 ?? process.env.SEARCH_URL_B64
  if (encoded) return encoded
  const plain = process.env.SEARCH_URL ?? textAt(new URL('agent/.search-url', import.meta.url))
  return plain ? Buffer.from(plain).toString('base64') : ''
}

/**
 * The gzipped document has to arrive inside the 10-MSS window. The budget leaves room for the
 * response headers and the other bytes that share the connection.
 */
const DOCUMENT_BUDGET_KB = 13.5

/**
 * The document carries its own stylesheet inside it.
 *
 * The browser only discovers a linked file after the document arrives, so that file costs a
 * second round trip and holds back the first paint. The inlined document stays inside the 10-MSS
 * window, the amount that a server sends before it waits for an acknowledgement, so one trip
 * carries the whole first paint.
 *
 * GitHub Pages caches the document for as long as it caches the assets and answers a re-visit
 * with 304, and the app is a single-page app: the document loads once per visit, so the inlined
 * bytes stay cacheable.
 *
 * The build fails when the document outgrows the window.
 */
function inlineStyles(): Plugin {
  let moved = ''
  let outDir = 'dist'
  return {
    name: 'inline-styles',
    apply: 'build',
    enforce: 'post',
    configResolved(cfg) {
      outDir = cfg.build.outDir
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // The document's own sheet, matched by the name that the link points at: a lazy screen
        // can carry a second stylesheet, and that one must stay a file.
        const sheets = Object.keys(ctx.bundle ?? {}).filter((f) => f.endsWith('.css'))
        const link = /<link rel="stylesheet"[^>]*href="[^"]*\/([^"/]+\.css)"[^>]*>/.exec(html)
        if (!link) {
          // A bundler upgrade that changes the tag would leave the sheet as a file, and the first
          // paint would wait on a second request again.
          if (sheets.length) {
            throw new Error(
              `inline-styles: the document links no stylesheet, but the bundle has ${sheets.join(', ')}`,
            )
          }
          return html
        }
        const file = sheets.find((f) => f.endsWith(link[1]))
        if (!file) {
          throw new Error(`inline-styles: ${link[1]} is not in the bundle, so it cannot be inlined`)
        }
        const sheet = String((ctx.bundle![file] as { source?: string }).source ?? '')
        moved = file
        // The replacement is a function, because a stylesheet may contain "$&" and friends.
        const doc = html.replace(link[0], () => `<style>${sheet}</style>`)
        const kb = (text: string): number => gzipSync(Buffer.from(text)).length / 1024
        const sheetKB = kb(sheet)
        const docKB = kb(doc)
        // A new screen or font grows the sheet, and the sheet goes inside the document, so the
        // check reads the document: one response has to carry all of it.
        if (docKB > DOCUMENT_BUDGET_KB) {
          throw new Error(
            `inline-styles: the document is ${docKB.toFixed(1)} kB gzipped, over the ` +
              `${DOCUMENT_BUDGET_KB} kB budget for the 10-MSS window (sheet ${sheetKB.toFixed(1)} kB)`,
          )
        }
        this.info(
          `inlined ${file}: sheet ${sheetKB.toFixed(1)} kB gzipped, document ${docKB.toFixed(1)} kB gzipped`,
        )
        return doc
      },
    },
    // Vite writes the stylesheet to disk and hands the build a copy of the bundle, so this
    // plugin deletes that file once the build is done.
    closeBundle() {
      if (!moved) return
      const target = resolve(root, outDir, moved)
      if (existsSync(target)) rmSync(target)
      moved = ''
    },
  }
}

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * Writes the list requests into the document as a script tag, ahead of every link and script.
 *
 * The app can only ask for these lists after its own code arrives from github.io. The same requests
 * from the document start while the document is still arriving, and the app joins them later, so
 * the reader waits once. The slower the path to the scripts, the more this saves.
 *
 * A preconnect to the picture host does not help: the covers go out as a burst that opens its
 * sockets in parallel, and that host uses HTTP/1.1, where a preconnect warms one socket at a time.
 */
function inlinePrefetch(): Plugin {
  return {
    name: 'inline-prefetch',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // It sits after the charset, so the parser reaches it as soon as the first bytes land. The
        // replacement is a function, so nothing in the script acts as a match pattern.
        return html.replace(
          /<meta charset[^>]*>/,
          (tag) => `${tag}\n    <script>${prefetchScript()}</script>`,
        )
      },
    },
  }
}

export default defineConfig({
  plugins: [solid(), tailwindcss(), inlinePrefetch(), inlineStyles()],
  // GitHub Pages serves at https://<user>.github.io/furmony-gallery/ (sub-path)
  base: '/furmony-gallery',
  define: { 'import.meta.env.VITE_SEARCH_URL_B64': JSON.stringify(encodedAddress()) },
  build: {
    rollupOptions: {
      output: {
        // uplot belongs to the statistics screen and panzoom to the full-screen viewer. Left out
        // of every shared chunk, each one stays inside the file of the screen that uses it.
        manualChunks(id) {
          if (id.includes('worker')) return undefined
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(uplot|@dschz|@panzoom)/.test(id)) return undefined
          return undefined
        },
      },
    },
  },
})
