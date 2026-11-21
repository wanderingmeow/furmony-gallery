// src/components/priceRange/PriceRail.tsx - the two ends of the price band, one row holding both.
// A boundary the CSS draws (--split) decides which end a press belongs to. The block above owns the
// filter: this reports a move and puts back the pair that survived.
import { createSignal } from "solid-js";
import { tr } from "../../i18n";
import { formatPrice } from "../../model/domain";
import {
  edgeOf,
  railShare,
  stepAt,
  stepIndex,
  type PriceEnd,
  type PriceRange,
} from "../../model/priceRange";
import { holdPointer } from "../../draw/trackPointer";

export function PriceRail(props: {
  /** The edges the thumbs rest on. */
  steps: number[];
  ends: PriceRange;
  /** Move one end to a step, and answer with the pair now held, or nothing when there is none. */
  onMove: (end: PriceEnd, index: number) => PriceRange | null;
}) {
  let row: HTMLDivElement | undefined;
  let lowEl: HTMLInputElement | undefined;
  let highEl: HTMLInputElement | undefined;
  const inputFor = (end: PriceEnd): HTMLInputElement | undefined =>
    end === "low" ? lowEl : highEl;

  const [pressed, setPressed] = createSignal<PriceEnd | null>(null);
  // Where the thumbs overlap, the end taken last is the one the reader means to take again.
  const [lastTaken, setLastTaken] = createSignal<PriceEnd | null>(null);
  // The ring on a thumb is for the keyboard. Safari hands :focus-visible to a focus that a press
  // gives over, so which end the keyboard is on is tracked here, and a press rings nothing.
  const [keyed, setKeyed] = createSignal<PriceEnd | null>(null);
  const [pressing, setPressing] = createSignal(false);
  // PriceRail.css moves --split to the near edge of this end, so its circle stays pressable whole.
  const topEnd = (): PriceEnd =>
    lastTaken() ??
    (railShare(props.steps, props.ends[0]) > 0.5 ? "low" : "high");

  /** Put the pair that survived back on the thumb: the browser moves it on its own, and a drag the
   *  neighbor stopped has not moved at all. */
  const take = (end: PriceEnd, index: number): void => {
    const next = props.onMove(end, index);
    const el = inputFor(end);
    if (next && el)
      el.value = String(stepIndex(props.steps, edgeOf(next, end)));
  };

  const seek =
    (end: PriceEnd) =>
    (event: PointerEvent): void => {
      const el = inputFor(end);
      const strip = event.currentTarget as HTMLElement | null;
      if (!el || !strip || !row) return;
      setPressed(end);
      setLastTaken(end);
      setPressing(true);
      setKeyed(null);
      // Without this, the panel scrolls to this row when the field takes the focus.
      el.focus({ preventScroll: true });
      const goTo = (x: number) =>
        take(end, stepAt(props.steps, row!.getBoundingClientRect(), x));
      // The strip holds the pointer, so a drag that wanders off still moves this end.
      holdPointer(strip, event.pointerId, goTo, () => {
        setPressed(null);
        setPressing(false);
      });
      goTo(event.clientX);
    };

  const thumb = (
    end: PriceEnd,
    label: string,
    hold: (el: HTMLInputElement) => void,
  ) => (
    <input
      ref={(el) => hold(el)}
      class="pr-thumb"
      classList={{ "pr-grab": pressed() === end, "pr-key": keyed() === end }}
      type="range"
      aria-label={label}
      min={0}
      max={props.steps.length - 1}
      step={1}
      value={stepIndex(props.steps, edgeOf(props.ends, end))}
      style={{ "z-index": topEnd() === end ? 3 : 2 }}
      aria-valuetext={formatPrice(edgeOf(props.ends, end))}
      // Tab reaches an end from elsewhere, and that is the keyboard.
      onFocus={() => {
        if (!pressing()) setKeyed(end);
      }}
      onBlur={() => {
        if (keyed() === end) setKeyed(null);
      }}
      onKeyDown={() => setKeyed(end)}
      onInput={(e) => take(end, Number(e.currentTarget.value))}
    />
  );

  return (
    <div
      ref={(el) => {
        row = el;
      }}
      class="pr-slide"
      classList={{ "pr-top-low": topEnd() === "low" }}
      style={{
        "--lo": String(railShare(props.steps, props.ends[0])),
        "--hi": String(railShare(props.steps, props.ends[1])),
      }}
    >
      <div class="pr-rail" />
      <div class="pr-band" />
      {/* Pointer targets only: the inputs below are the controls a screen reader should reach. */}
      <div
        class="pr-seek pr-seek-low"
        aria-hidden="true"
        onPointerDown={seek("low")}
      />
      <div
        class="pr-seek pr-seek-high"
        aria-hidden="true"
        onPointerDown={seek("high")}
      />
      {thumb("low", tr("filter.priceMin"), (el) => {
        lowEl = el;
      })}
      {thumb("high", tr("filter.priceMax"), (el) => {
        highEl = el;
      })}
    </div>
  );
}
