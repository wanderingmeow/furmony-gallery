// The table is hand-typed from links people send, so these tests read that file: a wrong adoptId,
// or a handle pasted as a URL, shows up only in the detail sheet, where the chip goes missing. `npm run socials` writes `public/socials.json` from
// this file, and stops on an entry the app cannot use.
import { describe, expect, it } from "vitest";
import { parseSocials, toSearchMap } from "./socials";

// The table names real accounts, so it is kept out of the repository. A glob that matches nothing is
// how this file reads as absent, and an empty table would pass every rule below.
const sources = import.meta.glob("../../scripts/socialsSource.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, unknown>>;
const kept = Object.keys(sources).length > 0;
const raw: Record<string, unknown> = Object.values(sources)[0] ?? {};

const entries = parseSocials(raw);

describe.skipIf(!kept)("the social table as it is typed", () => {
  it("parses every entry — nothing is silently dropped", () => {
    expect(entries.size).toBe(Object.keys(raw).length);
  });

  it("gives every entry at least one renderable account", () => {
    for (const [id, entry] of toSearchMap(entries)) {
      expect(entry.hasSocial, `#${id} has no usable platform`).toBe(true);
    }
  });

  // The usual mistake when typing an entry from a link: the whole URL ends up in the field.
  // buildUrl() would then produce https://x.com/https://x.com/handle.
  it("stores handles, not URLs", () => {
    for (const [id, entry] of entries) {
      for (const key of ["x", "tiktok", "bilibili"] as const) {
        const value = entry.platforms[key];
        if (typeof value === "string") {
          expect(value, `#${id} ${key}`).not.toMatch(/^(https?:)?\/\/|@|\/|\s/);
        }
      }
    }
  });
});

// The listings sample is gitignored, so this half runs only where the copies exist.
const fixtures = import.meta.glob("../../agent/*_sample.json");
const haveFixtures = Object.keys(fixtures).length >= 2;

describe.skipIf(!haveFixtures || !kept)(
  "socials.json points at listings the app can show",
  () => {
    it("every adoptId is in the listings sample", async () => {
      const ids = new Set<number>();
      for (const load of Object.values(fixtures)) {
        const mod = (await load()) as {
          default?: { rows?: { adoptId: number }[] };
        };
        for (const row of mod.default?.rows ?? []) ids.add(row.adoptId);
      }
      for (const id of Object.keys(raw)) {
        expect(ids.has(Number(id)), `#${id} is not in the listings`).toBe(true);
      }
    });
  },
);
