// src/components/ui/Switch.tsx - the iOS switch, for the settings that are simply on or off.
//
// The switch in the iOS settings app is 51×31. That size is for a full-height row, and in a
// panel this dense it is larger than the text next to it. The switch below is the same design at
// a smaller size, with the same gap on every side.
//
// The off track uses a theme token, so it changes in dark mode. The green is written out because
// iOS uses the same green in both themes.

const TRACK_W = 40
const TRACK_H = 24
const KNOB = 20
const BORDER = 1
/** The gap between the knob and the track edge, measured inside the border. */
const INSET = 1
// The knob starts inside the border, so the space it can travel in is 2px narrower than the
// track. The first version here used the full 40px, and the knob ended up flush against the
// right edge.
const TRAVEL = TRACK_W - BORDER * 2 - KNOB - INSET * 2

// The track is 24px tall and the tap target minimum is 44px, so +10px above and below make up
// the difference. To the right, the row's own padding gives 6px, and that is all this area can
// use: widening it on both sides made the panel's scroll container wider than the panel, and the
// panel got a horizontal scrollbar.
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
