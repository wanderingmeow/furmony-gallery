// A host that checks the Referer answers 403, and a 403 on an `<img>` looks exactly like a picture
// that stopped existing: a blank box and no error to show. So no picture element carries this page's
// address.
//
// The rule has two halves, and they are read two ways. Which files may write a picture is a rule
// about source, so the sources are read: it has to hold for elements added later, and a cover can
// come from any host that the manual review accepted. Whether the ask is on the element is asked of
// the element, because the ask is the behavior and one spelling of an attribute is not.
import { describe, expect, it } from "vitest";
import { render } from "solid-js/web";
import { RemoteImg } from "./components/ui/RemoteImg";
import { offscreenImage } from "./data/image";

const sources = import.meta.glob("./**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const DRAWN_IN = "./components/ui/RemoteImg.tsx";
const DOWNLOADED_IN = "./data/image/load.ts";

// A test's own regex is a piece of markup as far as a scan is concerned, so tests are not read.
const files = Object.entries(sources).filter(
  ([file]) => !file.includes(".test."),
);

const written = files.flatMap(([file, text]) =>
  [...text.matchAll(/<img\b[\s\S]*?\/>/g)].map(() => ({ file })),
);

// The code downloads a picture for itself under the same rule, but the ask sits on an element that
// no scan of the markup sees. So the rule here is narrower: only `data/image/load.ts` makes one.
const made = files.flatMap(([file, text]) =>
  [...text.matchAll(/new Image\(/g)].map(() => ({ file })),
);

describe("the pictures the app shows", () => {
  it("come from one element", () => {
    expect(written.map((x) => x.file).filter((f) => f !== DRAWN_IN)).toEqual(
      [],
    );
    expect(written.filter((x) => x.file === DRAWN_IN)).toHaveLength(1);
  });

  it("that one element asks for no referrer", () => {
    const host = document.createElement("div");
    const dispose = render(
      () => <RemoteImg src="https://a.example/b.jpg" />,
      host,
    );
    const drawn = host.querySelector("img");
    expect(drawn?.getAttribute("referrerpolicy")).toBe("no-referrer");
    dispose();
  });
});

describe("the pictures the script downloads", () => {
  it("come from one place", () => {
    expect(made.map((x) => x.file).filter((f) => f !== DOWNLOADED_IN)).toEqual(
      [],
    );
  });

  it("that one place asks for no referrer", () => {
    expect(offscreenImage().referrerPolicy).toBe("no-referrer");
  });
});
