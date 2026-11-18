/**
 * Dev only. Three settings for the placeholders, all read from the address:
 *
 * ?skeleton=on        the placeholders stay after the data lands, so you can look at them
 * ?skeleton=overlay   the real screen with the placeholders on top as outlines, so you can check
 *                     that the two line up
 * ?skeleton=related   the related row keeps its placeholders while the rest of the screen stays
 *                     real, so you can reach it from a real listing
 *
 * Nothing on screen sets any of them. The overlay draws orange outlines, because a gray
 * placeholder over a real card is nearly invisible and an edge a few pixels off would stay hidden.
 */
export type SkeletonView = 'off' | 'on' | 'overlay' | 'related'

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
  return q === 'on' || q === 'overlay' || q === 'related' ? q : 'off'
}

const view: SkeletonView = import.meta.env.DEV ? read() : 'off'

if (view === 'overlay') {
  const style = document.createElement('style')
  style.textContent = OVERLAY_CSS
  document.head.appendChild(style)
}

export const skeletonForced = () => view === 'on'
export const skeletonOverlay = () => view === 'overlay'
export const relatedSkeleton = () => view === 'related'
