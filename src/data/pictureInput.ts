// src/data/pictureInput.ts - the picture the search receives.
//
// A phone hands over several megabytes. The service reads any picture between 384 and 1024
// pixels on the long edge and resizes whatever arrives, so resizing here saves the trip:
// 89 KiB instead of three megabytes.
//
// The ground matters more than the size. The model has no notion of a transparent pixel: it
// reads the colour underneath, and underneath a cut-out that colour is black. So the canvas is
// filled white first, and a subject cut out of a photo arrives on the same pale ground as the
// stored settings.
//
// Decoding goes through an <img> rather than createImageBitmap, for two reasons that are the
// same one on iOS: only the image element applies the EXIF orientation tag, and only it decodes
// HEIC at all - a photo taken upright in portrait comes out sideways otherwise. Nothing is
// kept: the picture is decoded, drawn, encoded and dropped.

const LONG_EDGE = 768
const QUALITY = 0.85

/** How big to draw a picture of `width` × `height`: at most 768 on the long edge, never
 *  enlarged. The limit the service sets lives here so a test can call it. */
export function scaleOf(width: number, height: number): number {
  return Math.min(1, LONG_EDGE / Math.max(width, height))
}

/** The decoded picture, or null when the browser cannot read the file. */
function decode(url: string): Promise<HTMLImageElement | null> {
  const img = new Image()
  img.src = url
  if (img.decode) return img.decode().then(() => img, () => null)
  return new Promise((done) => {
    img.onload = () => done(img)
    img.onerror = () => done(null)
  })
}

/** The picture at most 768px on its long edge, on white, as a JPEG. */
export async function prepare(picture: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(picture)
  try {
    const img = await decode(url)
    // Nothing left the phone, so this is the browser's own verdict, not the service's: the
    // store says "use another picture" and the drop zone stays as it was.
    if (!img || !img.naturalWidth || !img.naturalHeight) return null
    const scale = scaleOf(img.naturalWidth, img.naturalHeight)
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    // The element's own bitmap is what gets drawn, orientation included; naturalWidth and
    // naturalHeight are measured the same way, so the two agree.
    ctx.drawImage(img, 0, 0, width, height)
    return await new Promise<Blob | null>((done) => canvas.toBlob((blob) => done(blob), 'image/jpeg', QUALITY))
  } finally {
    URL.revokeObjectURL(url)
  }
}
