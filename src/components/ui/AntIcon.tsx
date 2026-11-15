import { Dynamic } from 'solid-js/web'
import { createEffect, createMemo } from 'solid-js'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'

// Render an ant-design SVG glyph inline. `@ant-design/icons` ships React
// components (not usable in Solid), but `@ant-design/icons-svg` exposes the
// raw IconDefinition (AbstractNode tree) that we turn into a Solid `<svg>`.
// `Dynamic component={...}` lets a string tag name render as a real DOM element.
//
// `icon` may be a static definition OR an accessor `() => IconDefinition`. Both have to be
// read inside a computation: Solid runs a component body once, so reading it at creation
// freezes the glyph at whatever it was on the first render.
type IconNode = { tag: string; attrs: Record<string, string>; children?: IconNode[] }

function renderNode(node: IconNode): any {
  return (
    <Dynamic component={node.tag} {...node.attrs}>
      {node.children?.map((c) => renderNode(c))}
    </Dynamic>
  )
}

// Most ant-design glyphs are drawn inside a 64 64 896 896 box, so that is the box assumed when
// a glyph does not say. A few - the spinner is one - use the whole 0 0 1024 1024, and assuming
// the common box clips those to an off-centre fragment: a clipped ring looks like a wobble
// rather than a rotation.
const FALLBACK_VIEW_BOX = '64 64 896 896'

export function AntIcon(props: { icon: IconDefinition | (() => IconDefinition); class?: string; size?: string | number }) {
  // A memo, not a const: the sort buttons hand over an accessor, and reading it once would
  // never run again, so the arrows would sit pointing the first way forever.
  const root = createMemo<any>(() => {
    const def = typeof props.icon === 'function' ? props.icon() : props.icon
    return typeof def.icon === 'function' ? def.icon('currentColor', '#fff') : def.icon
  })
  let el!: SVGSVGElement
  // Written as an attribute rather than bound to a function: an SVG attribute takes a string,
  // and a function lands in the DOM as its own source text. An unreadable viewBox paints
  // nothing at all.
  createEffect(() => el.setAttribute('viewBox', root().attrs?.viewBox ?? FALLBACK_VIEW_BOX))
  return (
    <svg
      ref={el}
      viewBox={FALLBACK_VIEW_BOX}
      class={props.class}
      width={props.size ?? '1em'}
      height={props.size ?? '1em'}
      aria-hidden="true"
      fill="currentColor"
      style={{ display: 'inline-block', 'flex-shrink': 0, 'user-select': 'none' }}
    >
      {root().children?.map((c: IconNode) => renderNode(c))}
    </svg>
  )
}
