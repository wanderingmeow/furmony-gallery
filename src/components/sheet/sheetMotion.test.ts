import { describe, expect, it } from "vitest";
import {
  cardStyle,
  layerStyle,
  sheetRounded,
  type SheetPose,
} from "./sheetMotion";

const pose = (over: Partial<SheetPose> = {}): SheetPose => ({
  pos: 0,
  dragging: false,
  gestured: false,
  panel: false,
  fades: false,
  inset: 12,
  maxW: 1080,
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
  it("caps the width from the pose, and only where the card is a panel", () => {
    // the pose carries the width the detail measures its art against, so the two cannot disagree
    expect(cardStyle(pose({ panel: true, maxW: 1584 }))["max-width"]).toBe(
      "1584px",
    );
    expect(cardStyle(pose({ panel: false }))["max-width"]).toBeUndefined();
  });

  it("tells the card how far it stands in from the window", () => {
    // the stylesheet works out from this how much of each side band still reaches into the card
    expect(cardStyle(pose({ inset: 24 }))["--sheet-gap"]).toBe("24px");
    expect(cardStyle(pose({ inset: 0 }))["--sheet-gap"]).toBe("0px");
  });

  it("leaves the radius to the stylesheet", () => {
    expect(cardStyle(pose({ inset: 0 }))["border-radius"]).toBeUndefined();
    expect(cardStyle(pose({ inset: 12 }))["border-radius"]).toBeUndefined();
  });

  it("animates nothing on the card", () => {
    expect(cardStyle(pose({ dragging: true })).transition).toBeUndefined();
    expect(cardStyle(pose({ dragging: false })).transition).toBeUndefined();
  });
});

describe("the corners of a card away from the top edge", () => {
  // The marker rounds the corners only on a phone's sheet: a card with a gap to the window is
  // round all over.
  const phone = { inset: 0 };

  it("stay square while the card fills the screen, at rest and during the slide in", () => {
    expect(sheetRounded(pose(phone), false)).toBe(false);
    expect(sheetRounded(pose({ ...phone, pos: 1 }), false)).toBe(false);
  });

  it("turn round when the finger pulls the card", () => {
    const pull = pose({ ...phone, dragging: true, gestured: true, pos: 0.01 });
    expect(sheetRounded(pull, false)).toBe(true);
  });

  it("stay round while the card slides back and while it closes", () => {
    expect(sheetRounded(pose({ ...phone, gestured: true }), false)).toBe(true);
    expect(sheetRounded(pose(phone), true)).toBe(true);
  });

  it("stay off a card that stands in from the edges", () => {
    expect(sheetRounded(pose({ inset: 12, gestured: true }), true)).toBe(false);
  });
});
