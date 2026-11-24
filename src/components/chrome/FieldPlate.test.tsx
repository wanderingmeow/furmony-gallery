import { describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { tr } from "../../i18n";
import { FieldPlate } from "./FieldPlate";

function mount(props: Partial<Record<string, unknown>> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const given = {
    open: () => true,
    typed: () => false,
    pictureOn: () => false,
    semanticOn: () => false,
    onFocusField: () => {},
    onClose: () => {},
    onClearText: () => {},
    onTogglePicture: () => {},
    ...props,
  };
  const dispose = render(() => FieldPlate(given as never), host);
  return {
    host,
    acts: () =>
      [
        ...host.querySelectorAll("[data-chrome='acts'] button"),
      ] as HTMLButtonElement[],
    plate: () => host.querySelector("[data-chrome='plate']") as HTMLElement,
    done: () => {
      dispose();
      host.remove();
    },
  };
}

describe("the circle that gives the field up", () => {
  it("is the way out of the box while the field is empty", () => {
    const { acts, done } = mount();
    expect(acts()[0].getAttribute("aria-label")).toBe(tr("search.close"));
    done();
  });

  it("is the delete key once there is text to take back", () => {
    const { acts, done } = mount({ typed: () => true });
    expect(acts()[0].getAttribute("aria-label")).toBe(tr("search.clear"));
    done();
  });

  it("gives the text up without closing the box", () => {
    const close = vi.fn();
    const clear = vi.fn();
    const { acts, done } = mount({
      typed: () => true,
      onClose: close,
      onClearText: clear,
    });
    acts()[0].click();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    done();
  });

  it("closes the box when there is no text left", () => {
    const close = vi.fn();
    const clear = vi.fn();
    const { acts, done } = mount({ onClose: close, onClearText: clear });
    acts()[0].click();
    expect(close).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
    done();
  });
});

describe("the circle that asks for a picture", () => {
  it("stays out while the enhanced search is off", () => {
    const { acts, done } = mount();
    expect(acts()).toHaveLength(1);
    done();
  });

  it("lights while a picture is up", () => {
    const { acts, done } = mount({
      semanticOn: () => true,
      pictureOn: () => true,
    });
    const find = acts()[1];
    expect(find.getAttribute("aria-label")).toBe(tr("picture.find"));
    expect(find.getAttribute("aria-pressed")).toBe("true");
    done();
  });

  it("hands the ask over to the caller", () => {
    const toggle = vi.fn();
    const { acts, done } = mount({
      semanticOn: () => true,
      onTogglePicture: toggle,
    });
    acts()[1].click();
    expect(toggle).toHaveBeenCalledTimes(1);
    done();
  });

  it("stands the × down without taking it out of the row", () => {
    const { host, acts, done } = mount({
      semanticOn: () => true,
      pictureOn: () => true,
    });
    expect(acts()).toHaveLength(2);
    expect(
      host.querySelector("[data-chrome='acts'] > div")?.className,
    ).toContain("invisible");
    done();
  });
});

describe("the plate itself", () => {
  it("is a circle while the box is shut and ignores the tap", () => {
    const focus = vi.fn();
    const { plate, done } = mount({ open: () => false, onFocusField: focus });
    expect(plate().getAttribute("style")).toContain("--fab-size");
    plate().click();
    expect(focus).not.toHaveBeenCalled();
    done();
  });

  it("hands a tap back to the field once the box is open", () => {
    const focus = vi.fn();
    const { plate, done } = mount({ open: () => true, onFocusField: focus });
    plate().click();
    expect(focus).toHaveBeenCalledTimes(1);
    done();
  });

  it("hides the controls while the box is shut", () => {
    const { host, done } = mount({ open: () => false });
    expect(host.querySelector("[data-chrome='acts']")?.className).toContain(
      "invisible",
    );
    done();
  });
});
