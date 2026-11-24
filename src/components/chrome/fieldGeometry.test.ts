import { describe, expect, it } from "vitest";
import {
  FIELD_DROP,
  FIELD_LEAD,
  FIELD_PICTURE,
  FIELD_REST,
  FIELD_TEXT,
  FIELD_WIDE,
  PLATE_AIR,
} from "../../draw/layout";
import {
  FIELD_VARS,
  fieldHeight,
  fieldShape,
  fieldVars,
  plateAir,
} from "./fieldGeometry";

describe("which box the field stands in", () => {
  it("stays shut whatever the picture is doing", () => {
    expect(fieldShape(false, true, "empty")).toBe("shut");
    expect(fieldShape(false, false, "done")).toBe("shut");
  });

  it("takes the text row when no picture is up", () => {
    expect(fieldShape(true, false, "empty")).toBe("text");
  });

  it("gives the tall box to the empty drop zone alone", () => {
    expect(fieldShape(true, true, "empty")).toBe("drop");
    expect(fieldShape(true, true, "staged")).toBe("picture");
    expect(fieldShape(true, true, "failed")).toBe("picture");
    expect(fieldShape(true, true, "searching")).toBe("picture");
  });
});

describe("the height of that box", () => {
  it("stands every open row taller than the closed one it grows out of", () => {
    expect(fieldHeight("drop")).toBe(FIELD_DROP);
    expect(fieldHeight("picture")).toBe(FIELD_PICTURE);
    expect(fieldHeight("text")).toBe(FIELD_TEXT);
    expect(fieldHeight("shut")).toBe(FIELD_REST);
    expect(FIELD_DROP).toBeGreaterThan(FIELD_PICTURE);
    expect(FIELD_PICTURE).toBeGreaterThan(FIELD_TEXT);
    expect(FIELD_TEXT).toBeGreaterThan(FIELD_REST);
  });
});

describe("the numbers the band reads off the root", () => {
  it("writes exactly the properties the band clears away again", () => {
    for (const shape of ["shut", "text", "drop", "picture"] as const)
      expect(Object.keys(fieldVars(shape))).toEqual([...FIELD_VARS]);
  });

  it("keeps the line the circles stand centred on and moves the row start", () => {
    expect(fieldVars("shut")["--field-lead"]).toBe(`${FIELD_REST}px`);
    expect(fieldVars("text")["--field-lead"]).toBe(`${FIELD_LEAD}px`);
    expect(fieldVars("drop")["--field-h"]).toBe(`${FIELD_DROP}px`);
  });
});

describe("how far the plate stands back", () => {
  it("sits on the field's edge while the box is shut", () => {
    expect(plateAir("shut", 1280)).toBe("0px");
  });

  it("clears the corner's circle on a phone and takes a fixed measure when there is room", () => {
    expect(plateAir("text", 393)).toBe(PLATE_AIR);
    expect(plateAir("text", 640)).toBe(`calc(100% - ${FIELD_WIDE}px)`);
  });
});
