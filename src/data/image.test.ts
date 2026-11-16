// Functional tests for the signed-image URL map (image.ts). No network, no rendering.
// fake-indexeddb provides a real-ish IndexedDB; localStorage comes from the testSetup shim.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type ImageModule = typeof import('./image')

// fresh module per test → module-level imageUrlMap/dirtyPaths state is isolated
let img: ImageModule
beforeEach(async () => {
  vi.resetModules()
  img = await import('./image')
})

describe('stableImageUrl (img_url_map)', () => {
  it('maps a signed URL (with ?) and remembers the first-seen URL', () => {
    const first = img.stableImageUrl('https://a.jpg?sig=1')
    // same path with a different signature returns the remembered one
    expect(img.stableImageUrl('https://a.jpg?sig=999')).toBe('https://a.jpg?sig=1')
    expect(first).toBe('https://a.jpg?sig=1')
  })

  it('bypasses no-query URLs entirely (nothing stored, raw returned)', () => {
    expect(img.stableImageUrl('https://plain.jpg')).toBe('https://plain.jpg')
  })

  it('passes undefined through', () => {
    expect(img.stableImageUrl(undefined)).toBeUndefined()
  })

  it('persists dirty entries to IndexedDB and reloads them on a fresh module', async () => {
    img.stableImageUrl('https://a.jpg?x=1')
    await img.flushImageUrlMap()

    vi.resetModules()
    img = await import('./image')
    await img.initImageUrlMap()

    // remembered URL from DB wins over the fresh signature
    expect(img.stableImageUrl('https://a.jpg?y=2')).toBe('https://a.jpg?x=1')
  })
})

describe('urlPath (the part that identifies an image)', () => {
  it('drops the signature', () => {
    expect(img.urlPath('https://cdn.example/1.jpg?q-signature=abc'))
      .toBe('https://cdn.example/1.jpg')
  })

  it('leaves an unsigned URL alone', () => {
    expect(img.urlPath('https://cdn.example/1.jpg')).toBe('https://cdn.example/1.jpg')
  })

  // The compare also looks at text fields, and a name can end in a question mark.
  it('leaves text alone, question mark and all', () => {
    expect(img.urlPath('这是什么?')).toBe('这是什么?')
    expect(img.urlPath('/relative/path.png?x=1')).toBe('/relative/path.png?x=1')
  })
})
