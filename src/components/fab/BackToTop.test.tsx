import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { BackToTop } from "./BackToTop";

vi.mock("@solidjs/router", () => ({ useNavigate: () => () => {} }));

let dispose: (() => void) | undefined;
let host: HTMLDivElement;

const slot = () =>
  host.querySelector<HTMLButtonElement>('button[aria-label="回到顶部"]')
    ?.parentElement as HTMLElement;

function draw(scrollY: number) {
  dispose?.();
  host?.remove();
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => <BackToTop scrollTop={() => scrollY} onTop={() => {}} />,
    host,
  );
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  dispose?.();
  host?.remove();
});

describe("the bottom corner", () => {
  it("is out of the way while there is nowhere to go back to", () => {
    draw(0);
    expect(slot().className).toContain("invisible");
    expect(slot().className).toMatch(
      /mb-\[calc\(-1\*var\(--fab-size\)-0\.5rem\)\]/,
    );
  });

  it("hands itself back once the user has gone down", () => {
    draw(400);
    expect(slot().className).not.toContain("invisible");
  });
});
