// src/components/ui/Switch.tsx - the iOS switch, for the settings that are simply on or off.
//
// Apple's 51×31 is sized for a full-height settings row and dominates the text next to it in a
// panel this dense. Below is the same switch, smaller, with the same inset on every side.
//
// The off track is a theme token, so dark mode flips it. The green is literal because iOS keeps
// the same green in both themes.

const TRACK_W = 40
const TRACK_H = 24
const KNOB = 20
/** 1px border plus 1px inside it. */
const INSET = 1
const TRAVEL = TRACK_W - KNOB - INSET * 2

// +10px above and below brings the 24px track to the 44px minimum, which is what falls short of
// it. Only 6px to the right, the row's own padding: extending the area all around overflowed the
// panel's scroll container and gave the whole panel a horizontal scrollbar.
const HIT_AREA = "after:absolute after:inset-y-[-10px] after:left-0 after:right-[-6px] after:content-['']"

export function Switch(props: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      title={props.label}
      class={`relative shrink-0 rounded-full border transition-colors duration-200
              motion-reduce:transition-none ${HIT_AREA}`}
      style={{ width: `${TRACK_W}px`, height: `${TRACK_H}px` }}
      classList={{
        'bg-[#34C759] border-[#34C759]': props.on,
        'bg-surface-2 border-border': !props.on,
      }}
      onClick={() => props.onChange(!props.on)}
    >
      <span
        class="absolute rounded-full bg-white transition-transform duration-200
               shadow-[0_2px_5px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]
               motion-reduce:transition-none"
        style={{
          top: `${INSET}px`,
          left: `${INSET}px`,
          width: `${KNOB}px`,
          height: `${KNOB}px`,
          transform: props.on ? `translateX(${TRAVEL}px)` : 'translateX(0)',
        }}
      />
    </button>
  )
}
