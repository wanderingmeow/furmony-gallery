import { afterEach, describe, expect, it } from "vitest";
import { holdPinch } from "./pinchLock";

const touch = (id: number, target: Element) =>
  new Touch({ identifier: id, target, clientX: id * 12, clientY: 240 });

/** `touches` is read off the event by hand: the constructor is not trusted to keep the list. */
const fire = (type: string, target: Element, fingers: Element[]): boolean => {
  const touches = fingers.map((el, i) => touch(i + 1, el));
  const event = new TouchEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", { value: touches });
  Object.defineProperty(event, "changedTouches", { value: touches });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

const gesture = (target: Element): boolean => {
  const event = new Event("gesturestart", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

const box = (html: string): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
};

let dispose: (() => void) | null = null;
afterEach(() => {
  dispose?.();
  dispose = null;
  document.body.replaceChildren();
});

describe("holdPinch", () => {
  it("cancels a second finger where the page holds pinch", () => {
    dispose = holdPinch(true);
    const card = box('<div class="card"></div>')
      .firstElementChild as HTMLElement;
    expect(fire("touchstart", card, [card, card])).toBe(true);
  });

  it("cancels a move that already has two fingers", () => {
    dispose = holdPinch(true);
    const card = box('<div class="card"></div>')
      .firstElementChild as HTMLElement;
    expect(fire("touchmove", card, [card, card])).toBe(true);
  });

  it("leaves a single finger alone", () => {
    dispose = holdPinch(true);
    const card = box('<div class="card"></div>')
      .firstElementChild as HTMLElement;
    expect(fire("touchstart", card, [card])).toBe(false);
    expect(fire("touchmove", card, [card])).toBe(false);
  });

  it("leaves the second finger to a surface running its own pinch", () => {
    dispose = holdPinch(true);
    const host = box(
      '<div data-pinch-ok=""><div class="stage"><img alt=""></div></div>',
    );
    const deep = host.querySelector("div div") as HTMLElement;
    expect(fire("touchstart", deep, [deep, deep])).toBe(false);
  });

  it("cancels gesturestart", () => {
    dispose = holdPinch(true);
    const card = box('<div class="card"></div>')
      .firstElementChild as HTMLElement;
    expect(gesture(card)).toBe(true);
  });

  it("leaves an engine that obeys the zoom caps alone", () => {
    dispose = holdPinch(false);
    const card = box('<div class="card"></div>')
      .firstElementChild as HTMLElement;
    expect(fire("touchstart", card, [card, card])).toBe(false);
    expect(gesture(card)).toBe(false);
  });

  it("gives the second finger back once the hold is lifted", () => {
    holdPinch(true)();
    const card = box('<div class="card"></div>')
      .firstElementChild as HTMLElement;
    expect(fire("touchstart", card, [card, card])).toBe(false);
  });
});
