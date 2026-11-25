import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin, type UserConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { bundleWorker } from "./workerBundle.ts";
import { prefetchScript } from "./src/data/prefetch.ts";
import { ENDPOINT_URL } from "./src/data/endpoints.ts";

const ENDPOINTS = Object.keys(ENDPOINT_URL) as (keyof typeof ENDPOINT_URL)[];
import { bootWatchScript } from "./src/bootWatch.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * kB here means a thousand bytes, the unit the build table and the `content-length` header use.
 *
 * GitHub Pages compresses at level 5: the served document and a served chunk match zlib at level 5
 * byte for byte, so this figure is what the user waits for.
 */
const gzippedKB = (bytes: Uint8Array | string): number =>
  gzipSync(Buffer.from(bytes), { level: 5 }).length / 1000;

/**
 * What a repository copy does not carry: the address and the key that one machine keeps in
 * `.env`. A real environment variable wins over `.env`, which is how CI and a one-off build pass
 * them. A build with neither is normal: the feature that needs the value stays out of the bundle.
 */
function localValue(mode: string, name: string): string {
  return process.env[name] || loadEnv(mode, process.cwd(), "")[name] || "";
}

/** A value the built files should not carry as plain text, shipped as base64. The server address
 * names a machine you run, and the Translate key and the VAPID public key are public on their own
 * sites but are still what a secret scanner greps for. The encoded form wins when the environment
 * holds it, so a machine can keep that form instead of the plain one.
 */
function encoded(read: (name: string) => string, name: string): string {
  const already = read(`${name}_B64`);
  if (already) return already;
  const plain = read(name);
  return plain ? Buffer.from(plain).toString("base64") : "";
}

/** Where the build writes, joined to this project. */
const outPath = (outDir: string, ...parts: string[]): string =>
  resolve(root, outDir, ...parts);

/** A stylesheet the build emitted for one of the two entries. Each entry has to be there: one
 *  leaves the document without a first paint, the other the app without any style of its own. */
function emittedCss(
  bundle: Record<string, unknown>,
  entry: "boot" | "sheet",
): string {
  const file = Object.keys(bundle).find((f) =>
    new RegExp(`/${entry}-[^/]+\\.css$`).test(f),
  );
  if (!file)
    throw new Error(
      `the bundle carries no ${entry}-*.css, so nothing would paint`,
    );
  return file;
}

const hrefFor = (base: string, file: string): string =>
  `${base.endsWith("/") ? base : `${base}/`}${file}`;

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
  let outDir = "dist";
  let inlined = "";
  return {
    name: "inline-boot-sheet",
    apply: "build",
    enforce: "post",
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const file = emittedCss(ctx.bundle ?? {}, "boot");
        const sheet = String(
          (ctx.bundle![file] as { source?: string }).source ?? "",
        );
        inlined = file;
        // Under the title, ahead of every link, so the first bytes carry the first paint. The
        // replacement is a function, because a stylesheet may contain "$&" and friends.
        const doc = html.replace(
          /<\/title>/,
          () => `</title>\n    <style>${sheet}</style>`,
        );
        // A second stylesheet would put the spinner behind another round trip: CSS that a module
        // reaches belongs on the sheet the app waits for, which is src/index.css.
        const stray =
          /<link rel="stylesheet"(?![^>]*data-app-sheet)[^>]*>/.exec(doc);
        if (stray) {
          throw new Error(
            `the document links ${stray[0]}; import that stylesheet from src/index.css`,
          );
        }
        this.info(
          `boot sheet ${file}: ${gzippedKB(sheet).toFixed(2)} kB gzipped`,
        );
        return doc;
      },
    },
    // Nothing links the sheet now, so the build deletes the file.
    closeBundle() {
      if (!inlined) return;
      const target = outPath(outDir, inlined);
      if (existsSync(target)) rmSync(target);
      inlined = "";
    },
  };
}

/** The link is not render-blocking: a sheet the parser waits for would put the spinner behind
 *  another round trip. index.tsx waits for it instead, so the app mounts with its styles on. */
function appSheet(): Plugin {
  let base = "/";
  return {
    name: "app-sheet",
    apply: "build",
    enforce: "post",
    configResolved(cfg) {
      base = cfg.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const file = emittedCss(ctx.bundle ?? {}, "sheet");
        const href = hrefFor(base, file);
        this.info(`app sheet ${file} -> ${href}`);
        // beside the prefetch script, ahead of everything that costs a request
        return html.replace(
          /<meta charset[^>]*>/,
          (tag) => `${tag}\n    <link rel="preload" as="style" href="${href}" />
    <link rel="stylesheet" data-app-sheet href="${href}" media="print"
      onload="this.media='all'" onerror="window.__appSheetFailed = true" />`,
        );
      },
    },
  };
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
 *
 * `warmList` is false for a build that answers from the local copies, which must not ask the API.
 */
function inlineBootScripts(warmList = true): Plugin {
  return {
    name: "inline-boot-scripts",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        // They sit after the charset, so the parser reaches them as soon as the first bytes land. The
        // replacement is a function, so nothing in either script acts as a match pattern.
        return html.replace(
          /<meta charset[^>]*>/,
          (tag) =>
            `${tag}\n    <script>${bootWatchScript()}</script>\n    <script>${prefetchScript(warmList ? ENDPOINTS : [])}</script>`,
        );
      },
    },
  };
}

/**
 * The first paint has to arrive inside the 10-MSS window: the amount a server sends before it
 * waits for an acknowledgment. This number leaves room for the response headers and the other
 * bytes that share the connection.
 *
 * The document carries the spinner and the metadata only (src/boot.css), so the ceiling is about
 * what a document that grew back a whole stylesheet would cost.
 */
const DOCUMENT_BUDGET_KB = 5;

/* The worker is TypeScript under `src/worker`. A browser gets one file named `sw.js` beside the
document, because `serviceWorkerAddress()` registers only that path. */
const workerEntry = "src/worker/sw.ts";

function serviceWorker(): Plugin {
  let base = "/";
  // Every request rebuilds, so a saved file is always in the answer. A build already running is
  // shared, so the requests of one page load cost one build, and a failed build is not kept.
  let running: Promise<string> | undefined;
  const current = (): Promise<string> => {
    running ??= bundleWorker(root).finally(() => {
      running = undefined;
    });
    return running;
  };
  return {
    name: "service-worker",
    configResolved(cfg) {
      base = cfg.base;
    },
    // The published build is a separate run from `bundleWorker`, so the one-file rule is checked
    // here too.
    writeBundle(_options, bundle) {
      const worker = Object.values(bundle ?? {}).find(
        (one) => one.type === "chunk" && one.name === "sw",
      );
      if (!worker || worker.type !== "chunk") {
        throw new Error(
          `the build emitted no chunk named sw from ${workerEntry}`,
        );
      }
      const needed = [...worker.imports, ...worker.dynamicImports];
      if (needed.length > 0) {
        throw new Error(
          `${worker.fileName} would import ${needed.join(", ")}; a service worker has to be one ` +
            `file, because the browser may fetch it with no network`,
        );
      }
    },
    configureServer(server) {
      server.middlewares.use(hrefFor(base, "sw.js"), async (_req, res) => {
        try {
          res.setHeader("content-type", "text/javascript; charset=utf-8");
          res.end(await current());
        } catch (why) {
          res.statusCode = 500;
          res.end(`/* the worker did not compile: ${String(why)} */`);
        }
      });
    },
  };
}

function documentBudget(): Plugin {
  let outDir = "dist";
  return {
    name: "document-budget",
    apply: "build",
    enforce: "post",
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    writeBundle() {
      const doc = outPath(outDir, "index.html");
      if (!existsSync(doc)) return;
      const kb = gzippedKB(readFileSync(doc));
      if (kb > DOCUMENT_BUDGET_KB) {
        throw new Error(
          `${doc} is ${kb.toFixed(2)} kB gzipped, over the ` +
            `${DOCUMENT_BUDGET_KB} kB budget for the 10-MSS window`,
        );
      }
      this.info(
        `document ${kb.toFixed(2)} kB gzipped, budget ${DOCUMENT_BUDGET_KB} kB`,
      );
    },
  };
}

/**
 * The list the worker caches at install. The build writes it so it cannot drift from the build, and
 * it holds more than the document's own links: a route opened later has to be in it too.
 *
 * Out: the document (one key serves every route), the worker (it re-downloads itself on every
 * update check), and the 512 icons (the browser copies them at install, and the app never asks).
 * `icon-192.png` stays: a notification names it at display time.
 */
const precached = (file: string): boolean =>
  !file.endsWith(".html") &&
  file !== "sw.js" &&
  file !== "precache.json" &&
  !/-512\.png$/.test(file) &&
  file !== "apple-touch-icon.png";

/** Every file under a directory, with the separators a URL uses. */
const beneath = (dir: string, at = ""): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? beneath(`${dir}/${entry.name}`, at ? `${at}/${entry.name}` : entry.name)
      : [at ? `${at}/${entry.name}` : entry.name],
  );

function precacheList(): Plugin {
  let outDir = "dist";
  return {
    name: "precache-list",
    apply: "build",
    enforce: "post",
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    closeBundle() {
      const dir = outPath(outDir);
      if (!existsSync(dir)) return;
      const names = beneath(dir).filter(precached).sort();
      writeFileSync(resolve(dir, "precache.json"), JSON.stringify(names));
      const kb = names.reduce(
        (sum, name) => sum + gzippedKB(readFileSync(resolve(dir, name))),
        0,
      );
      this.info(`precache ${names.length} files, ${kb.toFixed(0)} kB gzipped`);
    },
  };
}

/** A first visitor would otherwise get every dependency as its own file, then a reload when the
 *  bundle lands. The door closes until the bundle is on disk and the module graph has stopped
 *  growing.
 *
 *  Bounded twice: a scan that finishes with nothing to build means there is no bundle, and a
 *  ceiling covers an optimizer that stops answering. */
function holdUntilWarm(ceilingMs = 20_000): Plugin {
  return {
    name: "hold-until-warm",
    apply: "serve",
    configureServer(server) {
      const env = server.environments.client;
      // the file the optimizer writes last: its presence means the build finished
      const meta = resolve(env.config.cacheDir, "deps/_metadata.json");
      const started = Date.now();
      const queue: (() => void)[] = [];
      const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
      let open = false;
      const release = (why: string) => {
        if (open) return;
        clearTimeout(ceiling);
        open = true;
        this.info?.(
          `serving after ${((Date.now() - started) / 1000).toFixed(2)}s: ${why}`,
        );
        queue.splice(0).forEach((go) => go());
      };
      /** A scan that finishes with nothing to build means there is no bundle to wait for. */
      const bundled = async () => {
        const deps = env.depsOptimizer;
        if (deps?.scanProcessing) await deps.scanProcessing;
        for (let i = 0; i < 40 && !existsSync(meta); i++) await wait(50);
        return existsSync(meta);
      };
      /** Transforming the entry walks the app; the graph going quiet for 300ms is that walk finishing. */
      const walked = async () => {
        await env.warmupRequest("/src/index.tsx");
        const size = () => env.moduleGraph.idToModuleMap.size;
        let seen = -1;
        let quiet = 0;
        while (quiet < 6) {
          const n = size();
          quiet = n === seen ? quiet + 1 : 0;
          seen = n;
          await wait(50);
        }
        return seen;
      };
      const warm = async () => {
        const hadBundle = await bundled();
        const modules = await walked();
        release(
          `${hadBundle ? "dependencies bundled" : "no dependencies to bundle"}, ${modules} modules ready`,
        );
      };
      // `release` reads this, and only `warm` calls `release`, which starts on the next line.
      const ceiling = setTimeout(
        () => release("the ceiling passed while the server warmed"),
        ceilingMs,
      );
      warm().catch(() => release("warming stopped answering"));
      server.middlewares.use((_req, _res, next) => {
        if (open) return next();
        queue.push(next);
      });
    },
  };
}

/**
 * Two entry points read this file: the command line build, and the demo-only dev config under
 * `agent/`. Hence a function that takes the mode and looks up the two values in `.env`.
 */
export function buildConfig(mode: string): UserConfig {
  const read = (name: string) => localValue(mode, name);
  // The sample listings in `agent/` are gitignored copies of the live answer, so the bundle that
  // reads them is a demo, not the published thing. `VITE_MOCK=1` has to be set for the build and the
  // preview alike: build writes dist-mock and preview reads it, which keeps a demo bundle out of the
  // directory the publish script reads. The dev server mocks without being told.
  const mock = /^(1|true|yes)$/i.test(read("VITE_MOCK"));
  const outDir = mock ? "dist-mock" : "dist";
  return {
    plugins: [
      holdUntilWarm(),
      solid(),
      tailwindcss(),
      inlineBootScripts(!mock),
      inlineBootSheet(),
      appSheet(),
      serviceWorker(),
      documentBudget(),
      precacheList(),
    ],
    // GitHub Pages serves at https://<user>.github.io/furmony-gallery/ (sub-path)
    base: "/furmony-gallery",
    // remote access to this dev machine, so the host stays open and the port is fixed
    server: { host: true, port: 5173, strictPort: true },
    // the same address for dev and preview; strictPort fails when the port is taken
    preview: { host: true, port: 5173, strictPort: true },
    define: {
      "import.meta.env.VITE_SERVER_ORIGIN_B64": JSON.stringify(
        encoded(read, "SERVER_ORIGIN"),
      ),
      "import.meta.env.VITE_TRANSLATE_KEY_B64": JSON.stringify(
        encoded(read, "TRANSLATE_KEY"),
      ),
      "import.meta.env.VITE_VAPID_PUBLIC_KEY_B64": JSON.stringify(
        encoded(read, "VAPID_PUBLIC_KEY"),
      ),
      "import.meta.env.VITE_MOCK": JSON.stringify(mock),
    },
    build: {
      /* Safari reads Tailwind's range-syntax breakpoints only from 16.4 and drops the rest without
         a word, so the target stays at the floor the app supports. */
      cssTarget: ["safari16", "ios16"],
      outDir,
      rollupOptions: {
        // three entries, three jobs: the html, the style the document carries inside it, and the
        // sheet the app waits for before it paints a single element
        input: {
          main: resolve(root, "index.html"),
          boot: resolve(root, "src/boot.css"),
          sheet: resolve(root, "src/index.css"),
          sw: resolve(root, workerEntry),
        },
        output: {
          // The registered name is fixed, so the worker keeps it; everything else keeps its hash.
          entryFileNames: (chunk) =>
            chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js",
        },
      },
    },
  };
}

export default defineConfig(({ mode }) => buildConfig(mode));
