import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

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
 * file next to this config. No value is a normal build — the feature stays hidden.
 */
function encodedAddress(): string {
  const encoded = process.env.VITE_SEARCH_URL_B64 ?? process.env.SEARCH_URL_B64
  if (encoded) return encoded
  const plain = process.env.SEARCH_URL ?? textAt(new URL('agent/.search-url', import.meta.url))
  return plain ? Buffer.from(plain).toString('base64') : ''
}

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  // GitHub Pages serves at https://<user>.github.io/furmony-gallery/ (sub-path)
  base: '/furmony-gallery',
  define: { 'import.meta.env.VITE_SEARCH_URL_B64': JSON.stringify(encodedAddress()) },
})
