// The stats filter and 价格显示 both build on this control, so these check the mechanics those
// two rely on.
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "solid-js/web";
import { SegmentedControl, type Segment } from "./SegmentedControl";

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
