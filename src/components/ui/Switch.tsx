// src/components/ui/Switch.tsx - the iOS switch, for settings that are on or off.
//
// The iOS settings switch is 51×31, a size for a full-height row: too big for a panel this dense.
// This is the same design smaller, with the same gap on every side.
//
// The off track uses a theme token, so it changes in dark mode. The green is written out because
// iOS uses the same green in both themes.
//
// A drag across the track works the way it does on iOS: the knob rides with the pointer, and a
// release past the middle of the track decides the value.
import { createSignal, onCleanup } from "solid-js";
import { followPointer } from "../../draw/trackPointer";
import { useHaptic } from "../../hooks/useHaptic";

const TRACK_W = 40;
const TRACK_H = 24;
const KNOB = 20;
const BORDER = 1;
/** The gap between the knob and the track edge, measured inside the border. */
const INSET = 1;
const TRAVEL = TRACK_W - BORDER * 2 - KNOB - INSET * 2;
// A press that has not moved this far is a tap: the click that follows makes the change.
const SLOP = 4;
// The growth that the price slider's thumb gets under a held finger, so every held control looks
// the same.
const SCALE = 1.18;

// 24px of track against a 44px tap target is +10px above and below. To the right the row gives 6px
// of padding: past that the panel's scroll container grows wider than the panel, and the panel gets
// a horizontal scrollbar. One value feeds the tap target and the buzz.
const HIT = "-10px -6px -10px 0";
const HIT_AREA = `after:absolute after:[inset:var(--hit)] after:content-['']`;

// The shadow is the iOS knob's: a soft drop and a tight edge under it.
const KNOB_LOOK = `absolute rounded-full bg-white motion-reduce:transition-none
                   shadow-[0_2px_5px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]`;

export function Switch(props: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  // How far the pointer has travelled since the press, in px, or null while nothing is held.
  const [drag, setDrag] = createSignal<number | null>(null);
  const [held, setHeld] = createSignal(false);
  let stopFollow: (() => void) | null = null;
  // The release runs this: iOS may have turned its switch without the page hearing a change.
  let syncHaptic = (): void => {};
  const rest = () => (props.on ? TRAVEL : 0);
  const knob = () => {
    const d = drag();
    if (d === null) return rest();
    return Math.min(Math.max(rest() + d, 0), TRAVEL);
  };
  // The scale comes after the travel, so the knob grows from where it stands. A scale before the
  // travel would stretch the distance it slides.
  const knobAt = () =>
    `translateX(${knob()}px)${held() ? ` scale(${SCALE})` : ""}`;
  // The green follows the knob, so a drag past the middle of the track shows the color that the
  // switch is about to take.
  const lit = () => knob() > TRAVEL / 2;

  let startX = 0;
  let startY = 0;
  // Whose gesture this turned out to be. The switch takes a drag along the track; a drag that
  // leans off it belongs to the panel's scroll, and `touch-pan-y` hands it over at the same angle
  // this picks, so the knob and the scroll never disagree.
  let axis: "x" | "y" | null = null;
  let moved = false;
  // Releasing a drag sends a click, which would flip the switch a second time, so the first one is
  // ignored. A new press clears the flag.
  let swallow = false;

  const moveTo = (x: number, y: number): void => {
    const dx = x - startX;
    const dy = y - startY;
    if (axis === null) {
      // Whose gesture this is stays unknown until the press has left the tap's drift, and the knob
      // waits on that: a drag the scroll takes never grows.
      if (Math.hypot(dx, dy) <= SLOP) return;
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis === "y") {
      // The scroll has it now: following stops, and the click a release sends is refused, so a drag
      // that leaned off the track cannot turn the switch.
      stopFollow?.();
      stopFollow = null;
      swallow = true;
      setHeld(false);
      return;
    }
    setHeld(true);
    moved = true;
    setDrag(dx);
  };

  const release = () => {
    const wanted = lit();
    stopFollow = null;
    setDrag(null);
    setHeld(false);
    if (moved) {
      swallow = true;
      if (wanted !== props.on) props.onChange(wanted);
    }
    syncHaptic();
  };

  const press = (event: PointerEvent) => {
    if (props.disabled) return;
    startX = event.clientX;
    startY = event.clientY;
    axis = null;
    moved = false;
    swallow = false;
    // A second finger takes the drag from the first, so two fingers do not pull at one knob.
    stopFollow?.();
    // eslint-disable-next-line solid/reactivity -- followPointer runs this when the finger lifts
    stopFollow = followPointer(event.pointerId, moveTo, () => {
      stopFollow = null;
      release();
    });
  };

  onCleanup(() => stopFollow?.());

  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      ref={(el) => {
        syncHaptic = useHaptic(el, () => props.on);
      }}
      // pan-y: a vertical drag goes to the panel's scroll.
      class={`relative shrink-0 rounded-full border transition-colors duration-200 touch-pan-y
              motion-reduce:transition-none ${HIT_AREA}`}
      style={{ width: `${TRACK_W}px`, height: `${TRACK_H}px`, "--hit": HIT }}
      classList={{
        "bg-accent border-accent": lit() && !props.disabled,
        "bg-surface-2 border-border": !lit() || !!props.disabled,
        "opacity-45 cursor-not-allowed": !!props.disabled,
      }}
      onPointerDown={press}
      // A disabled control blocks pointer events. The guard catches a click that code sends.
      onClick={() => {
        if (swallow) {
          swallow = false;
          return;
        }
        if (!props.disabled) props.onChange(!props.on);
      }}
    >
      <span
        // While the knob is held it follows the pointer, so no transition may sit between them. On
        // release it eases back through the rule below.
        class={`${KNOB_LOOK} ${held() ? "transition-none" : "transition-transform duration-200"}`}
        style={{
          top: `${INSET}px`,
          left: `${INSET}px`,
          width: `${KNOB}px`,
          height: `${KNOB}px`,
          transform: knobAt(),
        }}
      />
    </button>
  );
}
