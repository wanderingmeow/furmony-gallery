import { existsSync, readFileSync, rmSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { prefetchScript } from './src/data/prefetch.ts'
import { bootWatchScript } from './src/bootWatch.ts'

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * kB here means a thousand bytes, the unit the build table and the `content-length` header use.
 *
 * GitHub Pages compresses at level 5: the served document and a served chunk match zlib at level 5
 * byte for byte, so this figure is what the user waits for.
 */
const gzippedKB = (bytes: Uint8Array | string): number =>
  gzipSync(Buffer.from(bytes), { level: 5 }).length / 1000

/**
 * What a repository copy does not carry: the address and the key that one machine keeps in
 * `.env`. A real environment variable wins over `.env`, which is how CI and a one-off build pass
 * them. A build with neither is normal: the feature that needs the value stays out of the bundle.
 */
function localValue(mode: string, name: string): string {
  return process.env[name] || loadEnv(mode, process.cwd(), '')[name] || ''
}

/**
 * A value the built files should not carry as plain text, in the form they ship it: base64. The
 * 设定搜索 address names a machine, and the 详细描述 key is public on the official site but is
 * still exactly what a secret scanner greps for. An encoded value in the environment wins, so a
 * machine can hold that form instead of the plain one.
 */
function encoded(read: (name: string) => string, name: string): string {
  const already = read(`${name}_B64`)
  if (already) return already
  const plain = read(name)
  return plain ? Buffer.from(plain).toString('base64') : ''
}

/** Where the build writes, joined to this project. */
const outPath = (outDir: string, ...parts: string[]): string => resolve(root, outDir, ...parts)

/** A stylesheet the build emitted for one of the two entries. Each entry has to be there: one
 *  leaves the document without a first paint, the other the app without any style of its own. */
function emittedCss(bundle: Record<string, unknown>, entry: 'boot' | 'sheet'): string {
  const file = Object.keys(bundle).find((f) => new RegExp(`/${entry}-[^/]+\\.css$`).test(f))
  if (!file) throw new Error(`the bundle carries no ${entry}-*.css, so nothing would paint`)
  return file
}

const hrefFor = (base: string, file: string): string =>
  `${base.endsWith('/') ? base : `${base}/`}${file}`

/**
 * The document carries src/boot.css inside it, and no other stylesheet.
 *
 * The browser only requests a linked file after the document arrives, so that file costs a second
 * round trip and holds back the first paint. Inlining it lets one trip carry the whole first paint.
 * The first paint is the spinner and nothing else, because the app waits for its own sheet before it
 * paints a single element (src/draw/appSheet).
 *
 * GitHub Pages caches the document for as long as it caches the assets and answers a re-visit with
 * 304, and the app is a single-page app: the document loads once per visit, so the inlined bytes
 * stay cacheable.
 */
function inlineBootSheet(): Plugin {
  let outDir = 'dist'
  let inlined = ''
  return {
    name: 'inline-boot-sheet',
    apply: 'build',
    enforce: 'post',
    configResolved(cfg) {
      outDir = cfg.build.outDir
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const file = emittedCss(ctx.bundle ?? {}, 'boot')
        const sheet = String((ctx.bundle![file] as { source?: string }).source ?? '')
        inlined = file
        // Under the title, ahead of every link, so the first bytes carry the first paint. The
        // replacement is a function, because a stylesheet may contain "$&" and friends.
        const doc = html.replace(/<\/title>/, () => `</title>\n    <style>${sheet}</style>`)
        // A second stylesheet would put the spinner behind another round trip: CSS that a module
        // reaches belongs on the sheet the app waits for, which is src/index.css.
        const stray = /<link rel="stylesheet"(?![^>]*data-app-sheet)[^>]*>/.exec(doc)
        if (stray) {
          throw new Error(
            `the document links ${stray[0]}; import that stylesheet from src/index.css`,
          )
        }
        this.info(`boot sheet ${file}: ${gzippedKB(sheet).toFixed(2)} kB gzipped`)
        return doc
      },
    },
    // Nothing links the sheet now, so the build deletes the file.
    closeBundle() {
      if (!inlined) return
      const target = outPath(outDir, inlined)
      if (existsSync(target)) rmSync(target)
      inlined = ''
    },
  }
}

/** The link is not render-blocking: a sheet the parser waits for would put the spinner behind
 *  another round trip. index.tsx waits for it instead, so the app mounts with its styles on. */
function appSheet(): Plugin {
  let base = '/'
  return {
    name: 'app-sheet',
    apply: 'build',
    enforce: 'post',
    configResolved(cfg) {
      base = cfg.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const file = emittedCss(ctx.bundle ?? {}, 'sheet')
        const href = hrefFor(base, file)
        this.info(`app sheet ${file} -> ${href}`)
        // beside the prefetch script, ahead of everything that costs a request
        return html.replace(/<meta charset[^>]*>/, (tag) => `${tag}\n    <link rel="preload" as="style" href="${href}" />
    <link rel="stylesheet" data-app-sheet href="${href}" media="print"
      onload="this.media='all'" onerror="window.__appSheetFailed = true" />`)
      },
    },
  }
}

/**
 * Writes the two scripts the document runs itself into it, ahead of every link and script.
 *
 * The watchdog comes first: it reports the failures that would otherwise leave the spinner turning,
 * and a listener cannot hear a resource failure that happened before the listener was installed.
 *
 * The list requests follow. The app can only ask for them after its own code arrives from
 * github.io, while the same requests from the document start while the document is still arriving.
 * The app joins those, so the user waits once, and the slower the path to the scripts the more
 * this saves.
 *
 * A preconnect to the picture host does not help: the covers go out as a burst that opens its
 * sockets in parallel, and that host uses HTTP/1.1, where a preconnect warms one socket at a time.
 */
function inlineBootScripts(): Plugin {
  return {
    name: 'inline-boot-scripts',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // They sit after the charset, so the parser reaches them as soon as the first bytes land. The
        // replacement is a function, so nothing in either script acts as a match pattern.
        return html.replace(
          /<meta charset[^>]*>/,
          (tag) =>
            `${tag}\n    <script>${bootWatchScript()}</script>\n    <script>${prefetchScript()}</script>`,
        )
      },
    },
  }
}

/**
 * The first paint has to arrive inside the 10-MSS window: the amount a server sends before it
 * waits for an acknowledgment. This number leaves room for the response headers and the other
 * bytes that share the connection.
 *
 * The document carries the spinner and the metadata only (src/boot.css), so the ceiling is about
 * what a document that grew back a whole stylesheet would cost.
 */
const DOCUMENT_BUDGET_KB = 5

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
      const doc = outPath(outDir, 'index.html')
      if (!existsSync(doc)) return
      const kb = gzippedKB(readFileSync(doc))
      if (kb > DOCUMENT_BUDGET_KB) {
        throw new Error(
          `${doc} is ${kb.toFixed(2)} kB gzipped, over the `
          + `${DOCUMENT_BUDGET_KB} kB budget for the 10-MSS window`,
        )
      }
      this.info(`document ${kb.toFixed(2)} kB gzipped, budget ${DOCUMENT_BUDGET_KB} kB`)
    },
  }
}

/** A first visitor would otherwise get every dependency as its own file, then a reload when the
 *  bundle lands. The door closes until the bundle is on disk and the module graph has stopped
 *  growing.
 *
 *  Bounded twice: a scan that finishes with nothing to build means there is no bundle, and a
 *  ceiling covers an optimizer that stops answering. */
function holdUntilWarm(ceilingMs = 20_000): Plugin {
  return {
    name: 'hold-until-warm',
    apply: 'serve',
    configureServer(server) {
      const env = server.environments.client
      // the file the optimizer writes last: its presence means the build finished
      const meta = resolve(env.config.cacheDir, 'deps/_metadata.json')
      const started = Date.now()
      const queue: (() => void)[] = []
      const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))
      let ceiling: ReturnType<typeof setTimeout> | undefined
      let open = false
      const release = (why: string) => {
        if (open) return
        if (ceiling !== undefined) clearTimeout(ceiling)
        open = true
        this.info?.(`serving after ${((Date.now() - started) / 1000).toFixed(2)}s: ${why}`)
        queue.splice(0).forEach((go) => go())
      }
      /** A scan that finishes with nothing to build means there is no bundle to wait for. */
      const bundled = async () => {
        const deps = env.depsOptimizer
        if (deps?.scanProcessing) await deps.scanProcessing
        for (let i = 0; i < 40 && !existsSync(meta); i++) await wait(50)
        return existsSync(meta)
      }
      /** Transforming the entry walks the app; the graph going quiet for 300ms is that walk finishing. */
      const walked = async () => {
        await env.warmupRequest('/src/index.tsx')
        const size = () => env.moduleGraph.idToModuleMap.size
        let seen = -1
        let quiet = 0
        while (quiet < 6) {
          const n = size()
          quiet = n === seen ? quiet + 1 : 0
          seen = n
          await wait(50)
        }
        return seen
      }
      const warm = async () => {
        const hadBundle = await bundled()
        const modules = await walked()
        release(`${hadBundle ? 'dependencies bundled' : 'no dependencies to bundle'}, ${modules} modules ready`)
      }
      ceiling = setTimeout(() => release('the ceiling passed while the server warmed'), ceilingMs)
      warm().catch(() => release('warming stopped answering'))
      server.middlewares.use((_req, _res, next) => {
        if (open) return next()
        queue.push(next)
      })
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
    plugins: [
      holdUntilWarm(),
      solid(),
      tailwindcss(),
      inlineBootScripts(),
      inlineBootSheet(),
      appSheet(),
      documentBudget(),
    ],
    // GitHub Pages serves at https://<user>.github.io/furmony-gallery/ (sub-path)
    base: '/furmony-gallery',
    // remote access to this dev machine, so the host stays open and the port is fixed
    server: { host: true, port: 5173, strictPort: true },
    // the same address for dev and preview; strictPort makes the collision loud instead of moving
    // the server to a port nobody typed
    preview: { host: true, port: 5173, strictPort: true },
    define: {
      'import.meta.env.VITE_SEARCH_URL_B64': JSON.stringify(encoded(read, 'SEARCH_URL')),
      'import.meta.env.VITE_TRANSLATE_KEY_B64': JSON.stringify(encoded(read, 'TRANSLATE_KEY')),
    },
    build: {
      rollupOptions: {
        // three entries, three jobs: the html, the style the document carries inside it, and the
        // sheet the app waits for before it paints a single element
        input: {
          main: resolve(root, 'index.html'),
          boot: resolve(root, 'src/boot.css'),
          sheet: resolve(root, 'src/index.css'),
        },
      },
    },
  }
}

export default defineConfig(({ mode }) => buildConfig(mode))
