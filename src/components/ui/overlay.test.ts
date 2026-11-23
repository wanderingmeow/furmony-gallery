// What a layer keeps showing while it fades out or slides down.
import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { heldLast } from "./overlay";

describe("heldLast", () => {
  it("reads the source while it has a value", () => {
    createRoot((dispose) => {
      const [now, setNow] = createSignal<string | undefined>("one");
      const held = heldLast(() => now());
      expect(held()).toBe("one");
      setNow("two");
      expect(held()).toBe("two");
      dispose();
    });
  });

  it("keeps the last value while the source is empty, and lets a new one replace it", () => {
    createRoot((dispose) => {
      const [now, setNow] = createSignal<string | undefined>("one");
      const held = heldLast(() => now());
      setNow(undefined);
      expect(held()).toBe("one");
      setNow("three");
      expect(held()).toBe("three");
      setNow(undefined);
      expect(held()).toBe("three");
      dispose();
    });
  });

  // A detail whose id has gone is on its way out; one whose id names nothing on the shelf is a miss
  // the reader has to be told about.
  it("holds while the layer leaves, and shows a real miss while it stays", () => {
    createRoot((dispose) => {
      const [id, setId] = createSignal("7");
      const [row, setRow] = createSignal<string | undefined>("栗野");
      const held = heldLast(
        () => row(),
        () => !id(),
      );
      setRow(undefined);
      expect(held()).toBeUndefined();
      setId("");
      expect(held()).toBe("栗野");
      dispose();
    });
  });
});
