import { describe, expect, it } from "vitest";
import type { PictureResult } from "../data/searchApi";
import { outcomeOf } from "./pictureOutcome";

const found = (over: {
  ids?: number[];
  busy?: boolean;
  error?: string;
}): PictureResult => ({ ids: [], box: null, ...over });

describe("what an answer means", () => {
  it("ranks the list when ids came back", () => {
    expect(outcomeOf(found({ ids: [7, 3] }))).toBe("done");
  });

  it("reads an empty list with no reason as a complete answer", () => {
    expect(outcomeOf(found({ ids: [] }))).toBe("none");
  });

  it("reads a reason as a failure even when ids came back with it", () => {
    expect(outcomeOf(found({ ids: [7], error: "embed_down" }))).toBe("failed");
  });

  it("reads the service being busy as neither a failure nor an answer", () => {
    expect(outcomeOf(found({ ids: [], busy: true }))).toBe("busy");
    expect(outcomeOf(found({ ids: [], busy: true, error: "embed_down" }))).toBe(
      "busy",
    );
  });
});
