import { Dynamic } from 'solid-js/web'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'

// Render an ant-design SVG glyph inline. `@ant-design/icons` ships React
// components (not usable in Solid), but `@ant-design/icons-svg` exposes the
// raw IconDefinition (AbstractNode tree) that we turn into a Solid `<svg>`.
// `Dynamic component={...}` lets a string tag name render as a real DOM element.
//
// `icon` may be a static definition OR an accessor `() => IconDefinition`.
// Passing a function keeps the glyph reactive (e.g. swap sort-direction arrows);
// Solid props are evaluated once, so call it inside a reactive child expression.
type IconNode = { tag: string; attrs: Record<string, string>; children?: IconNode[] }

function renderNode(node: IconNode): any {
  return (
    <Dynamic component={node.tag} {...node.attrs}>
      {node.children?.map((c) => renderNode(c))}
    </Dynamic>
  )
}

export function AntIcon(props: { icon: IconDefinition | (() => IconDefinition); class?: string; size?: string | number }) {
  const root = (() => {
    const def = typeof props.icon === 'function' ? props.icon() : props.icon
    return typeof def.icon === 'function' ? def.icon('currentColor', '#fff') : def.icon
  })()
  return (
    <svg
      // Most ant-design glyphs are drawn inside a 64 64 896 896 box; a few - the spinner is
      // one - use the whole 0 0 1024 1024. Assuming the common one clips those to an
      // off-centre fragment, and a clipped ring reads as a wobble instead of a rotation.
      viewBox={root.attrs?.viewBox ?? '64 64 896 896'}
      class={props.class}
      width={props.size ?? '1em'}
      height={props.size ?? '1em'}
      aria-hidden="true"
      fill="currentColor"
      style={{ display: 'inline-block', 'flex-shrink': 0, 'user-select': 'none' }}
    >
      {root.children?.map((c) => renderNode(c as IconNode))}
    </svg>
  )
}
