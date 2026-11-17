import type { JSX } from 'solid-js'
import { SHEET_FAB_BOX } from './boxes'

/**
 * The round button that floats over a sheet: the ✕ that closes it, and the ← that walks
 * back through the settings you just looked at.
 */
export function SheetFab(props: { label: string; onClick: () => void; children: JSX.Element }) {
  return (
    <button
      class={`${SHEET_FAB_BOX} rounded-full glass sheet-fab flex items-center justify-center border border-border`}
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
    >
      {props.children}
    </button>
  )
}
