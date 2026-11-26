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

const CLIP = {
  bv: "BV1GJ411x7h7",
  cover: "https://i1.hdslb.com/bfs/archive/445b0ba5.jpg",
  seconds: 18,
};

describe("the built debut table", () => {
  it("keeps the album of a listing that has one", () => {
    const table = parseDebuts({
      "755": {
        pictures: ["https://i0.hdslb.com/a.jpg", "https://i0.hdslb.com/b.jpg"],
      },
    });
    expect([...table.keys()]).toEqual([755]);
    expect(table.get(755)!.pictures).toEqual([
      "https://i0.hdslb.com/a.jpg",
      "https://i0.hdslb.com/b.jpg",
    ]);
  });

  it("keeps the order the post told the album in", () => {
    const table = parseDebuts({
      "755": {
        pictures: ["https://i0.hdslb.com/1.jpg", "https://i0.hdslb.com/2.jpg"],
      },
    });
    expect(table.get(755)!.pictures.map((one) => one.slice(-5))).toEqual([
      "1.jpg",
      "2.jpg",
    ]);
  });

  it("keeps the clip with the cover and the length the build read", () => {
    const table = parseDebuts({ "755": { pictures: [], video: CLIP } });
    expect(table.get(755)).toEqual({ pictures: [], video: CLIP });
  });

  it("rounds a length written in parts of a second", () => {
    const table = parseDebuts({
      "755": { pictures: [], video: { ...CLIP, seconds: 18.6 } },
    });
    expect(table.get(755)!.video!.seconds).toBe(19);
  });

  // The album is what says the suit went to its owner, so a listing with only the clip is still a
  // listing the detail can open on.
  it("keeps a listing that has the clip and no album", () => {
    expect([
      ...parseDebuts({ "755": { pictures: [], video: CLIP } }).keys(),
    ]).toEqual([755]);
  });

  // A strip of broken squares is worse than no strip: the detail would open on it.
  it("drops a listing with no album and no clip", () => {
    const table = parseDebuts({
      "755": { pictures: [] },
      "77": { pictures: ["https://i0.hdslb.com/a.jpg"] },
    });
    expect([...table.keys()]).toEqual([77]);
  });

  it("drops an address that would not load from an https page", () => {
    const table = parseDebuts({
      "755": {
        pictures: ["http://i0.hdslb.com/a.jpg", "https://i0.hdslb.com/b.jpg"],
      },
    });
    expect(table.get(755)!.pictures).toEqual(["https://i0.hdslb.com/b.jpg"]);
  });

  it("drops a listing whose album is not a list", () => {
    expect(parseDebuts({ "755": { pictures: "a.jpg" } }).size).toBe(0);
  });

  it("drops a listing written without the album field", () => {
    expect(parseDebuts({ "755": "https://i0.hdslb.com/a.jpg" }).size).toBe(0);
  });

  // A clip that cannot open should take nothing down with it: the album beside it says the same
  // thing without the player.
  it("keeps the album when the clip is the part that is wrong", () => {
    const table = parseDebuts({
      "755": {
        pictures: ["https://i0.hdslb.com/a.jpg"],
        video: { ...CLIP, bv: "not-a-bilibili-id" },
      },
    });
    expect(table.get(755)).toEqual({
      pictures: ["https://i0.hdslb.com/a.jpg"],
    });
  });

  it("drops a clip whose cover would not load from an https page", () => {
    const table = parseDebuts({
      "755": {
        pictures: [],
        video: { ...CLIP, cover: "http://i1.hdslb.com/a.jpg" },
      },
    });
    expect(table.size).toBe(0);
  });

  it("drops a clip that gives no length or a length that is not a number", () => {
    for (const seconds of [undefined, 0, -3, "18", Number.NaN]) {
      const video = { ...CLIP, seconds } as unknown as typeof CLIP;
      expect(
        parseDebuts({ "755": { pictures: [], video } }).size,
        `${seconds}`,
      ).toBe(0);
    }
  });

  // The build's own file carries a `builtAt` and other words beside the debuts. Those are not
  // listings, and a table that read them as one would open a detail on nothing.
  it("ignores a key that is not a listing id", () => {
    const table = parseDebuts({
      builtAt: { pictures: ["https://i0.hdslb.com/a.jpg"] },
      "755": { pictures: ["https://i0.hdslb.com/b.jpg"] },
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
  it("carries the pictures and the clip of each listing and nothing beside them", () => {
    for (const [id, debut] of Object.entries(shipped)) {
      const { pictures, video } = debut as {
        pictures: unknown;
        video?: unknown;
      };
      expect(Array.isArray(pictures), `#${id}`).toBe(true);
      // A listing whose studio posted only a clip of the day says so with a clip and no album. One
      // that carries nothing at all is a line that read nothing.
      expect(
        (pictures as string[]).length > 0 || video !== undefined,
        `#${id}`,
      ).toBe(true);
      for (const url of pictures as string[])
        expect(url, `#${id}`).toMatch(/^https:\/\//);
      if (video !== undefined)
        expect(video, `#${id}`).toMatchObject({
          bv: expect.stringMatching(/^BV/),
          cover: expect.stringMatching(/^https:\/\//),
          seconds: expect.any(Number),
        });
    }
  });

  it("parses every listing — nothing is silently dropped", () => {
    expect(parseDebuts(shipped).size).toBe(Object.keys(shipped).length);
  });
});
