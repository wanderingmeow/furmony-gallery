// src/components/ui/Spinner.tsx - the mark for work the reader is waiting on.
//
// A ring drawn with borders, not an icon. Every loading glyph is a fragment of a circle
// with most of its ink far from the middle, and turning such a shape reads as orbiting
// about some other point. A ring has its mass on the circle, so it turns where the eye
// expects it to.
export function Spinner(props: { class?: string; size?: number }) {
  const px = () => `${props.size ?? 12}px`
  return (
    <span
      aria-hidden="true"
      class={`shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin ${props.class ?? ''}`}
      style={{ width: px(), height: px() }}
    />
  )
}
