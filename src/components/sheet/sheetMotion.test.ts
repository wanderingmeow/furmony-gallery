import { describe, expect, it } from "vitest";
import { SPREAD_MAX_W } from "../../draw/layout";
import {
  cardStyle,
  cornerPull,
  layerStyle,
  type SheetPose,
} from "./sheetMotion";

const pose = (
  over: Partial<SheetPose & { closing: boolean }> = {},
): SheetPose & { closing: boolean } => ({
  pos: 0,
  dragging: false,
  panel: false,
  fades: false,
  inset: 12,
  closing: false,
  ...over,
});

describe("the layer the card rides in", () => {
  it("slides a phone card up from the bottom of the screen", () => {
    expect(layerStyle(pose({ pos: 0.5 })).transform).toBe("translateY(50%)");
  });

  it("holds the transform where the finger left it", () => {
    expect(layerStyle(pose({ pos: 0.4, dragging: true })).transition).toBe(
      "none",
    );
  });

  it("eases the transform once the finger is gone", () => {
    expect(
      layerStyle(pose({ pos: 0.4, dragging: false })).transition,
    ).toContain("transform");
  });

  it("fades a card that sits in from every edge and grows it a little", () => {
    const style = layerStyle(pose({ fades: true, panel: true, pos: 1 }));
    expect(style.opacity).toBe("0");
    expect(style.transform).toBe("scale(0.97)");
  });

  it("keeps the gap that holds a panel off the edges", () => {
    expect(layerStyle(pose({ fades: true, pos: 0, inset: 24 })).padding).toBe(
      "24px",
    );
  });

  it("never scales a phone fade, which would uncover the backdrop", () => {
    expect(
      layerStyle(pose({ fades: true, panel: false, pos: 1 })).transform,
    ).toBeUndefined();
  });

  it("pays the gap on the way up too, not only on the fade", () => {
    expect(layerStyle(pose({ fades: false, inset: 24 })).padding).toBe("24px");
  });
});

describe("the card's own box", () => {
  it("caps the width only where the card is a panel", () => {
    expect(cardStyle(pose({ panel: true }))["max-width"]).toBe(
      `${SPREAD_MAX_W}px`,
    );
    expect(cardStyle(pose({ panel: false }))["max-width"]).toBeUndefined();
  });

  it("leaves every radius to the stylesheet, which reads the drag", () => {
    expect(cardStyle(pose({ inset: 0 }))["border-radius"]).toBeUndefined();
    expect(cardStyle(pose({ inset: 12 }))["border-radius"]).toBeUndefined();
  });

  it("waits for the finger and eases the radius after a release", () => {
    expect(cardStyle(pose({ dragging: true })).transition).toBe("none");
    expect(cardStyle(pose({ dragging: false })).transition).toContain(
      "border-radius",
    );
  });
});

describe("the top corners", () => {
  it("stay square on the way in, because opening also moves pos", () => {
    expect(cornerPull({ pos: 0.5, dragging: false, closing: false })).toBe(0);
  });

  it("finish rounding long before a drag counts as closing", () => {
    expect(cornerPull({ pos: 0.12, dragging: true, closing: false })).toBe(1);
  });

  it("follow the exit", () => {
    expect(cornerPull({ pos: 0.06, dragging: false, closing: true })).toBe(0.5);
  });
});
