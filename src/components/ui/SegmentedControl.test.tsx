// The stats filter and 价格显示 both build on this control, so these check the mechanics those
// two rely on.
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "solid-js/web";
import {
  SegmentedControl,
  type Segment,
  missFor,
  scaleFor,
} from "./SegmentedControl";

const ITEMS: Segment<string>[] = [
  { value: "a", label: "甲" },
  { value: "b", label: "乙" },
  { value: "c", label: "丙" },
];

let dispose: (() => void) | undefined;
let host: HTMLDivElement;

/** Renders the control with a signal behind the value, the way the callers use it. */
function draw(
  value = "a",
  over: Record<string, unknown> = {},
): (v?: string) => unknown {
  const [v, setV] = createSignal<string>(value);
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => (
      <SegmentedControl
        value={v}
        onChange={setV}
        items={ITEMS}
        label="测试"
        {...over}
      />
    ),
    host,
  );
  return setV;
}

const row = () => host.querySelector<HTMLElement>('[role="group"]')!;
const inputs = () =>
  Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
const labels = () =>
  Array.from(host.querySelectorAll<HTMLLabelElement>("label"));

afterEach(() => {
  dispose?.();
  host?.remove();
});

describe("SegmentedControl", () => {
  it("is one group of radio inputs, one per item", () => {
    draw();
    expect(row().getAttribute("aria-label")).toBe("测试");
    expect(inputs().map((i) => i.value)).toEqual(["a", "b", "c"]);
    expect(new Set(inputs().map((i) => i.name)).size).toBe(1);
  });

  it("checks the segment whose value the caller holds", () => {
    draw("b");
    expect(
      inputs()
        .filter((i) => i.checked)
        .map((i) => i.value),
    ).toEqual(["b"]);
  });

  it("keeps the chosen segment chosen after measuring the labels", () => {
    draw("b");
    expect(
      inputs()
        .filter((i) => i.checked)
        .map((i) => i.value),
    ).toEqual(["b"]);
  });

  it("leaves no measuring probe in the row", () => {
    draw("b");
    expect(inputs()).toHaveLength(3);
    expect(labels()).toHaveLength(3);
  });

  it("follows a value the caller changes from elsewhere", () => {
    const set = draw();
    set("c");
    expect(
      inputs()
        .filter((i) => i.checked)
        .map((i) => i.value),
    ).toEqual(["c"]);
  });

  it("reports the value when a segment is chosen", () => {
    const seen: string[] = [];
    const [v, setValue] = createSignal("a");
    const setV = (x: string) => {
      seen.push(x);
      setValue(x);
    };
    host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <SegmentedControl
          value={v}
          onChange={setV}
          items={ITEMS}
          label="测试"
        />
      ),
      host,
    );
    const b = inputs()[1];
    b.checked = true;
    b.dispatchEvent(new Event("change", { bubbles: true }));
    expect(seen).toEqual(["b"]);
  });

  it("retires the hairlines the chip cuts through", () => {
    draw("b");
    expect(labels().map((l) => l.classList.contains("seg-adj"))).toEqual([
      false,
      true,
      true,
    ]);
    expect(labels()[0].classList.contains("seg-first")).toBe(true);
  });

  it("draws the chip once the row has been measured", () => {
    draw();
    const chip = host.querySelector<HTMLElement>(".seg-chip");
    expect(chip).not.toBe(null);
    expect(chip!.getAttribute("aria-hidden")).toBe("true");
    expect(chip!.style.transform).toContain("translateX");
  });

  it("fills its box when the caller asks", () => {
    draw("a", { fill: true });
    expect(row().classList.contains("seg-fill")).toBe(true);
  });

  it("keeps a getter label current without rebuilding the row", () => {
    const [n, setN] = createSignal(7);
    const items: Segment<string>[] = [{ value: "a", label: () => `甲 ${n()}` }];
    host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <SegmentedControl
          value={() => "a"}
          onChange={() => {}}
          items={items}
          label="测试"
        />
      ),
      host,
    );
    expect(row().textContent).toContain("7");
    setN(9);
    expect(row().textContent).toContain("9");
  });
});

// The bottom pill's own floors, so these read the same arithmetic the row performs at runtime:
// 4 tab labels at their natural width, a corner column of 64px, 6px of label air, 12px of type.
const PILL = { labels: 196, side: 64, padMin: 6, typeMin: 0.857, border: 2 };
const pill = (room: number) =>
  scaleFor(
    room,
    PILL.labels,
    PILL.side,
    PILL.padMin,
    PILL.typeMin,
    PILL.border,
  );
/** What the row asks before it stands centred: whether the labels still fit at full size. */
const missFull = (room: number, centred = true) =>
  missFor(room, PILL.labels, PILL.side, PILL.padMin, 1, PILL.border, centred);
const miss = (room: number, centred = true) =>
  missFor(
    room,
    PILL.labels,
    PILL.side,
    PILL.padMin,
    PILL.typeMin,
    PILL.border,
    centred,
  );

describe("scaleFor", () => {
  it("keeps the labels full size where the band has room to spare", () => {
    expect(pill(468)).toBe(1);
  });

  it("shrinks the type once the air inside each segment is down to its floor", () => {
    expect(pill(361)).toBeCloseTo(175 / 196, 4);
  });

  it("stops at the type floor rather than read the counts smaller than a number", () => {
    expect(pill(288)).toBe(0.857);
  });

  it("has no corner column to pay inside a panel", () => {
    expect(scaleFor(300, 200, 0, 6, 0.9, 0)).toBe(1);
  });
});

describe("missFor", () => {
  it("leaves room in the centred band at an iPhone's width", () => {
    expect(miss(361)).toBeLessThan(0);
  });

  it("misses the centred band on the narrowest screen, so the row gives up the centre", () => {
    expect(miss(288)).toBeCloseTo(66, 0);
  });

  it("stands on the edge with the same labels nearly to spare", () => {
    expect(miss(288, false)).toBeCloseTo(2, 0);
  });

  it("gives up the centre before it would pay for it with a smaller type", () => {
    // 361 holds these labels at the type floor, and misses them at full size.
    expect(miss(361)).toBeLessThan(0);
    expect(missFull(361)).toBeGreaterThan(0);
  });

  it("keeps the centre where the labels fit at full size", () => {
    expect(missFull(361, false)).toBeLessThan(0);
    expect(missFull(468)).toBeLessThan(0);
  });
});
