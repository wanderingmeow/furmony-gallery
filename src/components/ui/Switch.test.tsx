// Switch: what a tap, a drag and a keyboard each answer with, and where the knob rides while the
// pointer holds it.
import { afterEach, describe, expect, it } from "vitest";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { withSwitch } from "../../testSetup";
import { Switch } from "./Switch";

let dispose: (() => void) | undefined;
let host: HTMLDivElement;
const [off, setOff] = createSignal(false);
const [on, setOn] = createSignal(false);
/** What the row above is asked to change to, in the order it was asked. */
const answers: boolean[] = [];

// The track is 40px and the knob travels 16px, so the middle sits at 8px.
const START_X = 100;

// Where the knob rests or rides. A held knob adds the growth every pressed control shares, read from
// the token, so the token stays the contract.
const at = (px: number) => `translateX(${px}px)`;
const heldAt = (px: number) => `${at(px)} scale(var(--press-grow))`;

function draw(start = false, held = false, refuse = false): void {
  dispose?.();
  host?.remove();
  answers.length = 0;
  setOff(held);
  setOn(start);
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => (
      <Switch
        on={on()}
        disabled={off()}
        label="语义搜索"
        onChange={(v) => {
          answers.push(v);
          if (!refuse) setOn(v);
        }}
      />
    ),
    host,
  );
}

const btn = () => host.querySelector<HTMLButtonElement>("button")!;
const knob = () => host.querySelector<HTMLElement>("button > span")!;
// On a phone the buzz label sits over the track, and that is what a finger arrives on.
const hit = () => host.querySelector<HTMLElement>(".haptic-hit") ?? btn();

// The buzz needs Safari's switch, and the label goes in at mount, so `withSwitch` runs before a
// draw. draw/haptics.test.ts covers that guard.

let pressX = START_X;
let pointerId = 1;
const press = (clientX = START_X) => {
  pressX = clientX;
  pointerId += 1;
  hit().dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, clientX, pointerId }),
  );
};
/** Move the held pointer `dx` px from where the press landed. */
const moveTo = (dx: number) =>
  hit().dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: pressX + dx,
      pointerId,
    }),
  );
/** Move the held pointer `dx` and `dy` px from where the press landed. */
const moveToXY = (dx: number, dy: number) =>
  hit().dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: pressX + dx,
      clientY: dy,
      pointerId,
    }),
  );
const letGo = () =>
  hit().dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, pointerId }),
  );
const dropped = () =>
  hit().dispatchEvent(
    new PointerEvent("pointercancel", { bubbles: true, pointerId }),
  );

afterEach(() => {
  dispose?.();
  host?.remove();
  withSwitch(false);
});

describe("Switch", () => {
  it("toggles on a tap", () => {
    draw();
    btn()!.click();
    expect(answers).toEqual([true]);
  });

  it("a drag past the middle opens it, and the click after does not undo it", () => {
    draw();
    press();
    moveTo(10);
    letGo();
    expect(answers).toEqual([true]);
    // The browser sends this click to the button when the press lets go.
    btn()!.click();
    expect(answers).toEqual([true]);
  });

  it("a drag back across the middle closes it", () => {
    draw(true);
    press();
    moveTo(-10);
    letGo();
    expect(answers).toEqual([false]);
  });

  it("a drag that stops short of the middle changes nothing", () => {
    draw();
    press();
    moveTo(5);
    letGo();
    expect(answers).toEqual([]);
    expect(knob().style.transform).toBe(at(0));
  });

  it("the knob follows the pointer and stops at the end of the track", () => {
    draw();
    press();
    moveTo(6);
    expect(knob().style.transform).toBe(heldAt(6));
    moveTo(40);
    expect(knob().style.transform).toBe(heldAt(16));
  });

  // A finger that has not leaned either way yet could still become the panel's scroll, so the knob
  // waits until the switch has taken the drag.
  it("the knob grows once the switch takes the drag, and returns on release", () => {
    draw();
    press();
    expect(knob().style.transform, "a finger alone is not yet a drag").toBe(
      at(0),
    );
    moveTo(6);
    expect(knob().style.transform).toBe(heldAt(6));
    letGo();
    expect(knob().style.transform).toBe(at(0));
  });

  it("the drag counts from where the knob rests", () => {
    draw(true);
    // A press near the right edge: the knob is already there, so it must not jump to the finger.
    press(START_X + 14);
    moveTo(-6);
    expect(knob().style.transform).toBe(heldAt(10));
  });

  // iOS hands a drag that leans off the track to the panel's scroll and takes the switch out of it.
  it("a drag that leans off the track goes to the scroll, knob and all", () => {
    draw();
    press();
    moveToXY(1, 2);
    expect(
      knob().style.transform,
      "inside the tap's drift, the knob still waits",
    ).toBe(at(0));
    moveToXY(2, 26);
    expect(knob().style.transform, "no growth, no travel").toBe(at(0));
    letGo();
    answers.length = 0;
    btn()!.click();
    expect(answers, "the click a release sends is refused").toEqual([]);
    btn()!.click();
    expect(answers, "a later tap still works").toEqual([true]);
  });

  // A second finger takes the drag from the first, so the knob must not keep the position the first
  // finger left it at, and must not stay grown while the second finger has moved nowhere.
  it("a second finger starts from where the knob rests", () => {
    draw();
    press();
    moveTo(12);
    expect(knob().style.transform).toBe(heldAt(12));
    press();
    expect(knob().style.transform, "no travel, no growth").toBe(at(0));
    moveTo(40);
    expect(knob().style.transform, "the second finger's own travel").toBe(
      heldAt(16),
    );
    letGo();
    expect(answers).toEqual([true]);
  });

  it("the first click after a drag is ignored, and the next one works", () => {
    draw();
    press();
    moveTo(10);
    letGo();
    answers.length = 0;
    btn()!.click();
    expect(answers).toEqual([]);
    btn()!.click();
    expect(answers).toEqual([false]);
  });

  it("a cancelled drag leaves the switch alone", () => {
    draw();
    press();
    moveTo(2);
    dropped();
    expect(answers).toEqual([]);
    expect(knob().style.transform).toBe(at(0));
  });

  // The knob crossing the middle is a drag in flight: the change comes on the release.
  it("aria-checked waits for the release", () => {
    draw();
    press();
    moveTo(12);
    expect(btn()!.getAttribute("aria-checked")).toBe("false");
  });

  it("the follow stops when the control goes away mid-drag", () => {
    draw();
    press();
    moveTo(140);
    // The panel closed under the finger, and the pointer keeps moving over what comes next. The rest
    // of the events go to the document, because a node that is gone cannot reach the listeners there.
    dispose?.();
    dispose = undefined;
    document.body.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX: 160 }),
    );
    document.body.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, clientX: 160 }),
    );
    expect(answers, "a switch that is gone changes nothing").toEqual([]);
  });

  it("a disabled switch does not answer", () => {
    draw(false, true);
    press();
    moveTo(14);
    letGo();
    btn()!.click();
    expect(answers).toEqual([]);
  });

  // The engine hands Chromium's pointer events to a disabled button, so the guard is the only thing
  // between a held-still switch and a change the reader did not mean to make. A drag can be under
  // the finger when that happens: a request started elsewhere answers and disables it.
  it("a switch held still mid-drag does not answer the release", () => {
    draw();
    press();
    moveTo(14);
    setOff(true);
    letGo();
    expect(answers, "the release belongs to no tap the reader meant").toEqual(
      [],
    );
  });

  // The buzz is a switch the reader turns, so a control that cannot take the tap has nothing to
  // buzz for, and the switch that buzzes is put out of reach while it is held still.
  it("a disabled switch gives no buzz", () => {
    withSwitch();
    draw(false, true);
    expect(
      host.querySelector<HTMLInputElement>(".haptic-switch")!.disabled,
      "nothing to buzz for",
    ).toBe(true);
  });

  it("the buzz comes back when the switch is let go", () => {
    withSwitch();
    draw(false, true);
    const buzz = () => host.querySelector<HTMLInputElement>(".haptic-switch")!;
    expect(buzz().disabled).toBe(true);
    setOff(false);
    expect(buzz().disabled, "the control can take the tap again").toBe(false);
    host.querySelector<HTMLElement>(".haptic-hit")!.click();
    expect(answers).toEqual([true]);
  });

  // The buzz is a switch behind a label over the track. The label must not take the tap or the drag
  // from the switch.
  it("the buzz label leaves the tap working", () => {
    withSwitch();
    draw();
    expect(host.querySelector(".haptic-hit")).not.toBeNull();
    btn()!.click();
    expect(answers).toEqual([true]);
  });

  it("the buzz label leaves the drag working", () => {
    withSwitch();
    draw();
    press();
    moveTo(10);
    letGo();
    expect(answers).toEqual([true]);
  });

  it("the buzz starts on the side the row already shows", () => {
    // A switch drawn from an `on` row has to buzz from the right side on the first frame, so the
    // effect has to run at mount rather than defer.
    withSwitch();
    draw(true);
    expect(
      host.querySelector<HTMLInputElement>(".haptic-switch")!.checked,
      "the effect runs at mount, not only on the next change",
    ).toBe(true);
  });

  // The tap lands on the label over the track, and the label turns the switch. The row shows one
  // value, so the switch is kept in step with it: left off, right on.
  it("the switch matches the value the row shows", () => {
    withSwitch();
    draw();
    const buzz = () => host.querySelector<HTMLInputElement>(".haptic-switch")!;
    expect(buzz().checked).toBe(false);
    host.querySelector<HTMLElement>(".haptic-hit")!.click();
    expect(answers).toEqual([true]);
    expect(buzz().checked, "the right side, because the row is on now").toBe(
      true,
    );
  });

  // The label turned the switch, and the row kept the value it had, so the page has to write that
  // value back.
  it("the switch returns when the row keeps the old value", () => {
    withSwitch();
    draw(false, false, true);
    const buzz = host.querySelector<HTMLInputElement>(".haptic-switch")!;
    host.querySelector<HTMLElement>(".haptic-hit")!.click();
    expect(answers).toEqual([true]);
    expect(
      buzz.checked,
      "the row kept the old value, so the switch goes back to the left",
    ).toBe(false);
  });

  it("the switch follows a value that the row changed elsewhere", () => {
    withSwitch();
    draw();
    setOn(true);
    expect(
      host.querySelector<HTMLInputElement>(".haptic-switch")!.checked,
    ).toBe(true);
  });

  // A drag that ends with the value as it was leaves the page nothing to react to: no `change`, and
  // no new value. The release syncs in that case too.
  it("the switch returns after a drag that the row did not take", () => {
    withSwitch();
    draw(false, false, true);
    const buzz = () => host.querySelector<HTMLInputElement>(".haptic-switch")!;
    press();
    moveTo(16);
    buzz().checked = true;
    letGo();
    expect(answers).toEqual([true]);
    expect(
      buzz().checked,
      "the row kept the old value, so the switch goes back to the left",
    ).toBe(false);
  });

  it("no buzz label where the engine has no switch", () => {
    withSwitch(false);
    draw();
    expect(host.querySelector(".haptic-hit")).toBeNull();
  });
});
