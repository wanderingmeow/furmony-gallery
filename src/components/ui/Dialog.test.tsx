// What a plate owes the page behind it: no reaching through, no Tabbing out, focus back where it was.
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { Dialog, type DialogAction } from "./Dialog";

let dispose: (() => void) | undefined;
let host: HTMLDivElement;
let root: HTMLDivElement;
let opener: HTMLButtonElement;

const plate = () => document.querySelector("[role='dialog']");
const row = () => plate()?.querySelector(".dialog-actions");
const backdrop = () => document.querySelector('[data-dialog="dim"]');
const buttons = () =>
  [...(plate()?.querySelectorAll("button") ?? [])] as HTMLButtonElement[];

const key = (name: string, shift = false): void => {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: name, shiftKey: shift, bubbles: true }),
  );
};

// Long enough for the departure to finish: the dim's fade is the slowest part of it.
const wait = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

function mount(
  open = true,
  actions: DialogAction[] = [
    { label: "Copy them", onPress: () => {}, tone: "recommended" },
    { label: "Got it", onPress: () => {} },
  ],
) {
  const [isOpen, setIsOpen] = createSignal(open);
  let closes = 0;
  dispose = render(
    () => (
      <Dialog
        open={isOpen}
        onClose={() => {
          closes += 1;
          setIsOpen(false);
        }}
        title="Hold on"
        actions={actions}
      >
        <p id="said">Something the user has to read first.</p>
      </Dialog>
    ),
    host,
  );
  return { setIsOpen, closes: () => closes };
}

beforeEach(() => {
  host = document.createElement("div");
  root = document.createElement("div");
  root.id = "root";
  opener = document.createElement("button");
  opener.textContent = "the thing that was pressed";
  root.appendChild(opener);
  document.body.append(host, root);
});

afterEach(() => {
  dispose?.();
  host.remove();
  root.remove();
});

describe("Dialog", () => {
  test("a plate that is not open is not in the page", () => {
    mount(false);
    expect(plate()).toBeNull();
    expect(root.hasAttribute("inert")).toBe(false);
  });

  test("the plate says what it is and where its words are", () => {
    mount();
    const said = plate()!;
    expect(said.getAttribute("aria-modal")).toBe("true");
    expect(
      document.getElementById(said.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("Hold on");
    expect(
      document.getElementById(said.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toContain("read first");
  });

  test("the page behind stops taking input while the plate is up", () => {
    const { setIsOpen } = mount();
    expect(root.getAttribute("inert")).toBe("");
    setIsOpen(false);
    expect(root.hasAttribute("inert")).toBe(false);
  });

  test("two answers come one under the other", () => {
    // Side by side, the longest locale wraps or overflows; a stack keeps every label on one line.
    mount();
    expect(buttons()).toHaveLength(2);
    expect(row()?.className).not.toContain("grid-cols");
  });

  test("one answer takes the row", () => {
    mount(true, [{ label: "Got it", onPress: () => {} }]);
    expect(buttons()).toHaveLength(1);
    expect(row()?.className).not.toContain("grid-cols");
  });

  test("three answers come one under the other", () => {
    mount(true, [
      { label: "One", onPress: () => {} },
      { label: "Two", onPress: () => {} },
      { label: "Three", onPress: () => {} },
    ]);
    expect(buttons()).toHaveLength(3);
    expect(row()?.className).not.toContain("grid-cols");
  });

  test("the destructive answer never wears the accent, and the accent never says destructive", () => {
    mount(true, [
      { label: "Delete", onPress: () => {}, tone: "destructive" },
      { label: "Keep", onPress: () => {}, tone: "recommended" },
    ]);
    const [delete_, keep] = buttons();
    expect(delete_.className).toContain("text-red-600");
    expect(delete_.className).not.toContain("bg-accent");
    expect(keep.className).toContain("bg-accent");
    expect(keep.className).not.toContain("text-red");
  });

  test("the user stands where they were standing before", () => {
    opener.focus();
    const { setIsOpen } = mount();
    expect(document.activeElement).toBe(plate());
    setIsOpen(false);
    expect(document.activeElement).toBe(opener);
  });

  test("Tab at the last stop returns to the first", () => {
    mount();
    const last = buttons().at(-1)!;
    last.focus();
    key("Tab");
    expect(document.activeElement).toBe(buttons()[0]);
  });

  test("Shift+Tab at the first stop returns to the last", () => {
    mount();
    const last = buttons().at(-1)!;
    buttons()[0]!.focus();
    key("Tab", true);
    expect(document.activeElement).toBe(last);
  });

  test("Escape answers it", () => {
    const { closes } = mount();
    key("Escape");
    expect(closes()).toBe(1);
  });

  test("a touch outside the plate answers nothing", () => {
    const { closes } = mount();
    plate()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    backdrop()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(closes()).toBe(0);
    expect(plate()).not.toBeNull();
  });

  test("the plate stays on screen for its own departure", async () => {
    const { setIsOpen } = mount();
    setIsOpen(false);
    expect(plate()).not.toBeNull();
    await wait(320);
    expect(plate()).toBeNull();
  });

  test("the dim blurs the page behind it and turns to leave the way it came", () => {
    const { setIsOpen } = mount();
    expect(backdrop()!.className).toContain("backdrop-blur-md");
    setIsOpen(false);
    expect(backdrop()!.className).toContain("animate-fade-out");
  });

  test("the page behind stops scrolling for as long as the layer is up", async () => {
    const { setIsOpen } = mount();
    expect(document.documentElement.style.overflow).toBe("hidden");
    setIsOpen(false);
    expect(document.documentElement.style.overflow).toBe("hidden");
    await wait(320);
    expect(document.documentElement.style.overflow).toBe("");
  });

  test("a notice whose words do not fit the screen can still be read to the end", () => {
    mount();
    expect(plate()!.className).toContain("overflow-y-auto");
    // svh, not dvh: a plate that grows when Safari folds its bar away moves under the reader
    expect(plate()!.className).toContain("max-h-[calc(100svh-2.5rem)]");
  });
});
