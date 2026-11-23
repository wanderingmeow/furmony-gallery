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

// The track's own 8px of padding. `--seg-frame` in SegmentedControl.css holds this plus the border.
const TRACK_PAD = 8;
/* Giving up the centre is a visible jump, so coming back takes clear slack: a band a pixel either
   side of the line would otherwise flicker between the two. */
const CENTRE_HOLD = 8;

/** The size the labels are drawn at when nothing is given up. */
const FULL_TYPE = 1;

/** What the labels still miss the band by at both floors, positive being what they cannot pay.
 *  Centred pays the corner column twice; on the edge of the band it is paid once. */
export function missFor(
  room: number,
  labels: number,
  side: number,
  padMin: number,
  typeMin: number,
  border: number,
  centred = true,
): number {
  const reserve = centred ? 2 * side : side;
  return labels * typeMin + 8 * padMin + TRACK_PAD + border - (room - reserve);
}

/** How large the labels can be in the room left to them, the row's own air having given first. */
export function scaleFor(
  room: number,
  labels: number,
  side: number,
  padMin: number,
  typeMin: number,
  border: number,
  centred = true,
): number {
  const give =
    room - TRACK_PAD - border - (centred ? 2 * side : side) - 8 * padMin;
  return Math.min(1, Math.max(typeMin, give / labels));
}

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
  // The row's own width comes from its labels, so a wider or narrower band leaves it the same size:
  // only an observer on the measured box answers a page zoom.
  let ro: ResizeObserver | undefined;
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
  const num = (name: string): number =>
    parseFloat(getComputedStyle(row).getPropertyValue(name)) || 0;
  const containerOf = (el: HTMLElement): boolean =>
    getComputedStyle(el).containerType.includes("inline");
  const px = (v: string): number => parseFloat(v) || 0;
  /* The box the padding rule divides up, measured rather than asked for: legacy WebKit answers
     100cqw with a query container's border box, so a container wearing the page's 1rem of padding
     reads 32px wider than the width the pill is laid out in. CSS and script divide the same
     --seg-room. */
  const roomOf = (): number => {
    let box: HTMLElement | null = row.parentElement;
    while (box && !containerOf(box)) box = box.parentElement;
    // No query container: the units fall back to the viewport, so the measurement does too.
    if (!box) return innerWidth;
    if (ro) ro.observe(box);
    const cs = getComputedStyle(box);
    return (
      box.getBoundingClientRect().width -
      px(cs.paddingLeft) -
      px(cs.paddingRight) -
      px(cs.borderLeftWidth) -
      px(cs.borderRightWidth)
    );
  };
  // Every tab is as wide as the widest, so the row costs the widest tab times the count.
  let type = 1;

  /* What the text wants at its natural size, measured outside the grid: a clone stands absolutely at
     type 1, so the row's own width cannot feed back into the number that decides it. All the clones
     go in before the first reading, so one layout pays for the whole row. */
  const PROBE =
    "position:absolute;left:0;top:0;width:auto;min-width:0;white-space:nowrap;visibility:hidden;--seg-type:1";
  const natural = (items: HTMLLabelElement[]): number[] => {
    const probes = items.map((el) => {
      const probe = el.cloneNode(true) as HTMLElement;
      probe.style.cssText = PROBE;
      // A clone of a live radio joins the same group and takes the choice away from the row for
      // good, and the label's colour hangs off input:checked. The radio is screen-reader only, so it
      // holds none of the width being read here.
      for (const input of probe.querySelectorAll("input")) input.remove();
      return probe;
    });
    for (const probe of probes) row.appendChild(probe);
    const widths = probes.map((probe) =>
      Math.max(
        0,
        ...[
          ...probe.querySelectorAll<HTMLElement>(".seg-label, .seg-hint"),
        ].map((line) => line.getBoundingClientRect().width),
      ),
    );
    for (const probe of probes) probe.remove();
    return widths;
  };

  const want = () => {
    const items = props.items
      .map((s) => seen.get(s.value))
      .filter((el): el is HTMLLabelElement => el !== undefined);
    const widest = Math.max(0, ...natural(items));
    if (widest <= 0 || items.length === 0) return;
    const labels = widest * items.length;
    row.style.setProperty("--seg-labels", `${labels}px`);
    const room = roomOf();
    if (!(room > 0)) return;
    row.style.setProperty("--seg-room", `${room}px`);
    const side = num("--seg-side");
    const padMin = num("--seg-pad-min");
    const typeMin = num("--seg-type-min") || 1;
    const border = 2 * px(getComputedStyle(row).borderLeftWidth);
    // The centre is bought with a corner column, so it is kept only while the labels keep their
    // full size: paying for it with a smaller type would show a wider phone a smaller pill than the
    // one standing on the edge below it.
    const miss = missFor(room, labels, side, padMin, FULL_TYPE, border);
    const centred =
      row.dataset.segAnchor === "left" ? miss < -CENTRE_HOLD : miss <= 0;
    row.dataset.segAnchor = centred ? "centred" : "left";
    const next = scaleFor(room, labels, side, padMin, typeMin, border, centred);
    if (Math.abs(next - type) > 0.005) {
      type = next;
      // The CSS font-size rule multiplies this.
      row.style.setProperty("--seg-type", String(next));
    }
  };
  const measure = () => {
    want();
    const el = seen.get(props.value());
    if (!el) return;
    const r = ring();
    const next = {
      x: el.offsetLeft + r,
      w: Math.max(0, el.offsetWidth - r * 2),
    };
    const now = chip();
    // Rebuilding the chip is layout, and Safari answers layout with another observer call: a fresh
    // object every pass never settles.
    if (
      !now ||
      Math.abs(now.x - next.x) > 0.5 ||
      Math.abs(now.w - next.w) > 0.5
    )
      setChip(next);
  };

  onMount(() => {
    ro = new ResizeObserver(measure);
    ro.observe(row);
    for (const el of seen.values()) ro.observe(el);
    measure();
    onCleanup(() => ro?.disconnect());
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
