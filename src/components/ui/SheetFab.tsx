import type { JSX } from 'solid-js'

/**
 * The round button that floats over a sheet: the ✕ that closes it, and the ← that walks
 * back through the settings you just looked at.
 */
export function SheetFab(props: { label: string; onClick: () => void; children: JSX.Element }) {
  return (
    <button
      class="w-11 h-11 rounded-full glass sheet-fab flex items-center justify-center border border-border"
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
    >
      {props.children}
    </button>
  )
}
