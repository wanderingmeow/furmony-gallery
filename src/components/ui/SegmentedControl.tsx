import {
  createEffect,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  type JSX,
} from "solid-js";

/** A getter lets the line follow its own data while the row stays put. */
export type SegmentLine = JSX.Element | (() => JSX.Element);

const line = (v: SegmentLine): JSX.Element =>
  typeof v === "function" ? (v as () => JSX.Element)() : v;

export interface Segment<V extends string> {
  value: V;
  label: SegmentLine;
  /** A second, smaller line under the label: the tab pill puts each count here. */
  hint?: SegmentLine;
}

/**
 * A row of segments with one chosen, in the shape shadcn's segmented control uses: a track, a
 * chip that slides to the chosen one, and a hairline between neighbors that fades away where
 * the chip touches it.
 *
 * The segments are radio inputs in one group, so the arrow keys move the choice. The chip is
 * measured, because a label's width can change when the data arrives.
 */
export function SegmentedControl<V extends string>(props: {
  value: () => V;
  onChange: (v: V) => void;
  items: Segment<V>[];
  /** Names the group, for a screen user and for the radio group. */
  label: string;
  /** Each segment takes an equal share of the box the row sits in. */
  fill?: boolean;
  /** The page's main switch wants the orange; inside a panel it is noise. */
  accent?: boolean;
  class?: string;
}) {
  let row!: HTMLDivElement;
  const seen = new Map<V, HTMLLabelElement>();
  // The chip waits for its first measurement, so it appears already in place.
  const [chip, setChip] = createSignal<{ x: number; w: number } | null>(null);

  const at = () => props.items.findIndex((s) => s.value === props.value());
  // The hairline sits on an item's left edge, so the chip cuts through its own item's line and
  // the next one's.
  const adjacent = (i: number) => i === at() || i === at() + 1;

  // the pill asks for a ring; a row inside a panel takes 0 and its chip fills the tab
  const ring = () =>
    parseFloat(getComputedStyle(row).getPropertyValue("--chip-inset")) || 0;
  // Every tab is as wide as the widest, so the row charges the widest tab times the count and the
  // rule that shares the air reads that number. A span's width does not depend on its padding, so
  // the two cannot chase each other.
  const want = () => {
    const widths = props.items
      .map((s) => seen.get(s.value))
      .filter((el): el is HTMLLabelElement => el !== undefined)
      .map((el) =>
        Math.max(
          0,
          ...[...el.querySelectorAll<HTMLElement>(".seg-label, .seg-hint")].map(
            (line) => line.scrollWidth,
          ),
        ),
      );
    const widest = Math.max(0, ...widths);
    if (widest > 0 && widths.length > 0) {
      row.style.setProperty("--seg-labels", `${widest * widths.length}px`);
    }
  };
  const measure = () => {
    want();
    const el = seen.get(props.value());
    if (!el) return;
    const r = ring();
    setChip({ x: el.offsetLeft + r, w: Math.max(0, el.offsetWidth - r * 2) });
  };

  onMount(() => {
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    for (const el of seen.values()) ro.observe(el);
    onCleanup(() => ro.disconnect());
  });
  createEffect(on(() => props.value(), measure));

  return (
    <div
      ref={row}
      role="group"
      aria-label={props.label}
      class={`seg-row no-pick ${props.accent ? "seg-accent" : ""} ${props.fill ? "seg-fill" : ""} ${props.class ?? ""}`}
    >
      <Show when={chip()}>
        {(c) => (
          <span
            class="seg-chip"
            style={{ transform: `translateX(${c().x}px)`, width: `${c().w}px` }}
            aria-hidden="true"
          />
        )}
      </Show>
      <For each={props.items}>
        {(s, i) => (
          <label
            ref={(el) => seen.set(s.value, el)}
            class={`seg-item ${i() === 0 ? "seg-first" : ""}`}
            classList={{
              "seg-adj": adjacent(i()),
              "seg-stacked": s.hint !== undefined,
            }}
          >
            <input
              type="radio"
              name={props.label}
              value={s.value}
              checked={props.value() === s.value}
              onChange={() => props.onChange(s.value)}
              class="sr-only"
            />
            <span class="seg-label">{line(s.label)}</span>
            <Show when={s.hint !== undefined}>
              <span class="seg-hint">{line(s.hint!)}</span>
            </Show>
          </label>
        )}
      </For>
    </div>
  );
}
