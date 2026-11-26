import { describe, expect, it } from "vitest";
import { parseDebuts } from "./debuts";

// The table `npm run debuts` wrote is kept out of the repository: it names real posts. A glob that
// matches nothing is how this file reads as absent, and an empty table would pass every rule below.
const tables = import.meta.glob("../../public/debuts.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, unknown>>;
const kept = Object.keys(tables).length > 0;
const shipped: Record<string, unknown> = Object.values(tables)[0] ?? {};

describe("the built debut table", () => {
  it("keeps the album of a listing that has one", () => {
    const table = parseDebuts({
      "755": ["https://i0.hdslb.com/a.jpg", "https://i0.hdslb.com/b.jpg"],
    });
    expect([...table.keys()]).toEqual([755]);
    expect(table.get(755)).toEqual([
      "https://i0.hdslb.com/a.jpg",
      "https://i0.hdslb.com/b.jpg",
    ]);
  });

  it("keeps the order the post told the album in", () => {
    const table = parseDebuts({
      "755": ["https://i0.hdslb.com/1.jpg", "https://i0.hdslb.com/2.jpg"],
    });
    expect(table.get(755)!.map((one) => one.slice(-5))).toEqual([
      "1.jpg",
      "2.jpg",
    ]);
  });

  // A strip of broken squares is worse than no strip: the detail would open on it.
  it("drops a listing whose album has nothing left in it", () => {
    const table = parseDebuts({
      "755": [],
      "77": ["https://i0.hdslb.com/a.jpg"],
    });
    expect([...table.keys()]).toEqual([77]);
  });

  it("drops an address that would not load from an https page", () => {
    const table = parseDebuts({
      "755": ["http://i0.hdslb.com/a.jpg", "https://i0.hdslb.com/b.jpg"],
    });
    expect(table.get(755)).toEqual(["https://i0.hdslb.com/b.jpg"]);
  });

  it("drops a listing whose album is not a list", () => {
    expect(parseDebuts({ "755": "https://i0.hdslb.com/a.jpg" }).size).toBe(0);
  });

  // The build's own file carries a `builtAt` and other words beside the albums. Those are not
  // listings, and a table that read them as one would open a detail on nothing.
  it("ignores a key that is not a listing id", () => {
    const table = parseDebuts({
      builtAt: ["https://i0.hdslb.com/a.jpg"],
      "755": ["https://i0.hdslb.com/b.jpg"],
    });
    expect([...table.keys()]).toEqual([755]);
  });

  it("reads a file that is not a table as nothing", () => {
    for (const bad of [null, undefined, "[]", 7, true]) {
      expect(parseDebuts(bad).size).toBe(0);
    }
  });
});

describe.skipIf(!kept)("the shipped debuts.json", () => {
  // The file is minified and stripped by `npm run debuts`: every byte here is paid by every visit.
  it("carries an album per listing and nothing beside it", () => {
    for (const [id, album] of Object.entries(shipped)) {
      expect(Array.isArray(album), `#${id}`).toBe(true);
      expect((album as string[]).length, `#${id}`).toBeGreaterThan(0);
    }
  });

  it("parses every listing — nothing is silently dropped", () => {
    expect(parseDebuts(shipped).size).toBe(Object.keys(shipped).length);
  });
});
