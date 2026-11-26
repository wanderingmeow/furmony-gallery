// The iOS switch, for settings that are on or off.
//
// The iOS settings switch is 51×31, a size for a full-height row: too big for a panel this dense.
// This is the same design smaller, with a 2px gap between the knob and the track's edge.
//
// Both states take theme tokens, so the fill is the app's accent rather than iOS's green, and dark
// mode flips it with every other color.
import { useHaptic } from "../../hooks/useHaptic";
import { useKnobDrag } from "../../hooks/useKnobDrag";

const TRACK_W = 40;
const TRACK_H = 24;
const KNOB = 20;
const BORDER = 1;
/** The gap between the knob and the track edge, measured inside the border. */
const INSET = 1;
const TRAVEL = TRACK_W - BORDER * 2 - KNOB - INSET * 2;

// The shadow is the iOS knob's: a soft drop and a tight edge under it. A disabled switch drops it:
// a shadow makes the knob look raised and tappable, and the knob sits fainter than the track around
// it.
const KNOB_BASE =
  "absolute rounded-full bg-white motion-reduce:transition-none";
const KNOB_RAISE =
  "shadow-[0_2px_5px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]";
const KNOB_MUTED = "opacity-70";

export function Switch(props: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  // The release runs this: iOS may have turned its switch without the page hearing a change.
  let syncHaptic = (): void => {};
  const blocked = () => !!props.disabled;
  const knob = useKnobDrag(TRAVEL, {
    live: () => !blocked(),
    value: () => props.on,
    onChange: (on) => props.onChange(on),
    settled: () => syncHaptic(),
  });

  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      ref={(el) => {
        syncHaptic = useHaptic(el, () => props.on, blocked);
      }}
      // pan-y: a vertical drag goes to the panel's scroll.
      class="switch relative shrink-0 rounded-full border transition-colors duration-200 touch-pan-y
             motion-reduce:transition-none"
      style={{ width: `${TRACK_W}px`, height: `${TRACK_H}px` }}
      classList={{
        // The fill follows the knob, so a drag past the middle shows the color the switch is about
        // to take.
        "bg-accent border-accent": knob.pastMiddle() && !blocked(),
        "bg-surface-2 border-border": !knob.pastMiddle() || blocked(),
        "opacity-45 cursor-not-allowed": blocked(),
      }}
      onPointerDown={knob.press}
      // A disabled control blocks pointer events. The guard catches a click that code sends.
      onClick={() => {
        if (knob.clickToIgnore()) return;
        if (!blocked()) props.onChange(!props.on);
      }}
    >
      <span
        // A transition would keep the knob behind the finger, so none runs while the knob is held;
        // the release eases back. `--press-grow` is the growth every pressed control shares.
        class={KNOB_BASE}
        classList={{
          [KNOB_MUTED]: blocked(),
          [KNOB_RAISE]: !blocked(),
          "transition-none": knob.held(),
          "transition-transform duration-200": !knob.held(),
        }}
        style={{
          top: `${INSET}px`,
          left: `${INSET}px`,
          width: `${KNOB}px`,
          height: `${KNOB}px`,
          transform: `translateX(${knob.x()}px)${
            knob.held() ? " scale(var(--press-grow))" : ""
          }`,
        }}
      />
    </button>
  );
}
