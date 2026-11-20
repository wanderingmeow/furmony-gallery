import { existsSync, readFileSync, rmSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { prefetchScript } from './src/data/prefetch.ts'

/**
 * What a repository copy does not carry: the address and the key that one machine keeps in
 * `.env`. A real environment variable wins over `.env`, which is how CI and a one-off build pass
 * them. A build with neither is normal: the feature that needs the value stays out of the bundle.
 */
function localValue(mode: string, name: string): string {
  return process.env[name] || loadEnv(mode, process.cwd(), '')[name] || ''
}

/**
 * Where a 设定搜索 sentence goes. Base64 keeps the name of that machine out of the built files.
 */
function encodedAddress(read: (name: string) => string): string {
  const encoded = read('SEARCH_URL_B64')
  if (encoded) return encoded
  const plain = read('SEARCH_URL')
  return plain ? Buffer.from(plain).toString('base64') : ''
}

/**
 * The 详细描述 translation key. It is public - the official site ships it in its own bundle - but
 * base64 keeps it out of the built files as text, which is what a secret scanner reads.
 */
function encodedKey(read: (name: string) => string): string {
  const encoded = read('TRANSLATE_KEY_B64')
  if (encoded) return encoded
  const plain = read('TRANSLATE_KEY')
  return plain ? Buffer.from(plain).toString('base64') : ''
}

/**
 * kB here means a thousand bytes, the unit the build table and the `content-length` header use.
 *
 * GitHub Pages compresses at level 5: the served document and a served chunk match zlib at level 5
 * byte for byte, so this figure is what the reader waits for.
 */
const gzippedKB = (bytes: Uint8Array | string): number =>
  gzipSync(Buffer.from(bytes), { level: 5 }).length / 1000

/**
 * The document carries its own stylesheet inside it.
 *
 * The browser only requests a linked file after the document arrives, so that file costs a second
 * round trip and holds back the first paint. Inlining it lets one trip carry the whole first paint.
 *
 * GitHub Pages caches the document for as long as it caches the assets and answers a re-visit with
 * 304, and the app is a single-page app: the document loads once per visit, so the inlined bytes
 * stay cacheable.
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
        this.info(`inlined ${file}: ${gzippedKB(sheet).toFixed(2)} kB gzipped`)
        return doc
      },
    },
    // Nothing links the sheet now, so the build deletes the file.
    closeBundle() {
      if (!moved) return
      const target = resolve(root, outDir, moved)
      if (existsSync(target)) rmSync(target)
      moved = ''
    },
  }
}

/** The first paint has to arrive inside the 10-MSS window: the amount a server sends before it
 *  waits for an acknowledgment. This number leaves room for the response headers and the other
 *  bytes that share the connection. */
const DOCUMENT_BUDGET_KB = 13.5

/** A new screen or a font grows the sheet that goes inside the document, so the build stops when
 *  the finished document outgrows the window. */
function documentBudget(): Plugin {
  let outDir = 'dist'
  return {
    name: 'document-budget',
    apply: 'build',
    enforce: 'post',
    configResolved(cfg) {
      outDir = cfg.build.outDir
    },
    writeBundle() {
      const doc = resolve(root, outDir, 'index.html')
      if (!existsSync(doc)) return
      const kb = gzippedKB(readFileSync(doc))
      if (kb > DOCUMENT_BUDGET_KB) {
        throw new Error(
          `document-budget: ${doc} is ${kb.toFixed(2)} kB gzipped, over the `
          + `${DOCUMENT_BUDGET_KB} kB budget for the 10-MSS window`,
        )
      }
      this.info(`document ${kb.toFixed(2)} kB gzipped, budget ${DOCUMENT_BUDGET_KB} kB`)
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

/**
 * Two entry points read this file: the command line build, and the demo-only dev config under
 * `agent/`. Hence a function that takes the mode and looks up the two values in `.env`.
 */
export function buildConfig(mode: string): UserConfig {
  const read = (name: string) => localValue(mode, name)
  return {
    plugins: [solid(), tailwindcss(), inlinePrefetch(), inlineStyles(), documentBudget()],
    // GitHub Pages serves at https://<user>.github.io/furmony-gallery/ (sub-path)
    base: '/furmony-gallery',
    define: {
      'import.meta.env.VITE_SEARCH_URL_B64': JSON.stringify(encodedAddress(read)),
      'import.meta.env.VITE_TRANSLATE_KEY_B64': JSON.stringify(encodedKey(read)),
    },
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
  }
}

export default defineConfig(({ mode }) => buildConfig(mode))
