// A picture element never tells the host where the request came from. A host that refuses a
// foreign referrer answers 403, and a 403 on an `<img>` looks exactly like a picture that
// stopped existing: a blank box and no error to show.
//
// `RemoteImg` holds that ask, so the rule kept here is that nothing else writes `<img>`. The
// sources are read rather than a rendered page because the rule has to hold for elements
// written later, and a cover can come from any host the 人工审核 accepted.
import { describe, expect, it } from "vitest";

const sources = import.meta.glob("./**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const DRAWN_IN = "./components/ui/RemoteImg.tsx";
const NONE = 'referrerpolicy="no-referrer"';

const written = Object.entries(sources)
  .filter(([file]) => !file.endsWith(".test.tsx"))
  .flatMap(([file, text]) =>
    [...text.matchAll(/<img\b[\s\S]*?\/>/g)].map((m) => ({ file, tag: m[0] })),
  );

describe("the pictures the app shows", () => {
  it("come from one element", () => {
    expect(written.map((x) => x.file).filter((f) => f !== DRAWN_IN)).toEqual(
      [],
    );
  });

  it("that one element asks for no referrer", () => {
    const drawn = written.filter((x) => x.file === DRAWN_IN);
    expect(drawn.length).toBe(1);
    expect(drawn[0].tag).toContain(NONE);
  });
});
