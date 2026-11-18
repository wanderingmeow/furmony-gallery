/**
 * Dev only. Two settings for the list area, both read from the address:
 *
 * ?skeleton=on       the placeholders stay after the data lands, so you can look at them
 * ?skeleton=overlay  the real screen with the placeholders on top as outlines, so you can check
 *                    that the two line up
 *
 * Nothing on screen sets either one. The overlay draws orange outlines, because a gray
 * placeholder over a real card is nearly invisible and an edge a few pixels off would stay hidden.
 */
export type SkeletonView = 'off' | 'on' | 'overlay'

/** The class every placeholder box carries, so the overlay can reach each one. */
export const SK_BOX = 'sk-box'

const OVERLAY_CSS = `
.sk-overlay .sk-pulse { animation: none; }
.sk-overlay .sk-bar, .sk-overlay .sk-box, .sk-overlay .search-field {
  background: transparent;
  border-color: var(--color-orange-500);
  outline: 1px solid var(--color-orange-500);
  outline-offset: -1px;
}`

function read(): SkeletonView {
  const q = new URLSearchParams(window.location.search).get('skeleton')
  return q === 'on' || q === 'overlay' ? q : 'off'
}

const view: SkeletonView = import.meta.env.DEV ? read() : 'off'

if (view === 'overlay') {
  const style = document.createElement('style')
  style.textContent = OVERLAY_CSS
  document.head.appendChild(style)
}

export const skeletonForced = () => view === 'on'
export const skeletonOverlay = () => view === 'overlay'
