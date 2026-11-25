import { describe, expect, test } from "vitest";
import { serviceWorkerAddress, watchUpdate } from "./serviceWorker";

const ORIGIN = "https://app.test";
const ROOT = `${ORIGIN}/furmony-gallery/`;

describe("serviceWorkerAddress", () => {
  test("the subpath survives, because a worker cannot control paths above itself", () => {
    expect(
      serviceWorkerAddress(
        "/furmony-gallery",
        "https://wanderingmeow.github.io",
      ),
    ).toEqual({
      url: "https://wanderingmeow.github.io/furmony-gallery/sw.js",
      scope: "https://wanderingmeow.github.io/furmony-gallery/",
    });
  });

  test("a base that already ends in a slash does not get a second one", () => {
    expect(serviceWorkerAddress("/furmony-gallery/", ORIGIN).scope).toBe(ROOT);
  });

  test("an app served at the domain root keeps that root", () => {
    expect(serviceWorkerAddress("/", ORIGIN)).toEqual({
      url: `${ORIGIN}/sw.js`,
      scope: `${ORIGIN}/`,
    });
  });
});

describe("a newer worker taking over", () => {
  /** The browser's controller, with the listeners a takeover would reach. */
  const board = (controlled: boolean) => {
    const listeners: (() => void)[] = [];
    return {
      controller: controlled ? { scriptURL: "sw.js" } : null,
      addEventListener: (_type: string, done: () => void) =>
        void listeners.push(done),
      takeover: () => listeners.forEach((done) => done()),
      watched: () => listeners.length,
    };
  };

  test("a page that loaded under a worker asks for its own address again", () => {
    const nav = board(true);
    let reloads = 0;
    watchUpdate(nav, () => void reloads++);
    nav.takeover();
    expect(reloads).toBe(1);
  });

  test("the first visit is not behind anything, so nothing reloads it", () => {
    const nav = board(false);
    let reloads = 0;
    watchUpdate(nav, () => void reloads++);
    expect(nav.watched()).toBe(0);
    nav.takeover();
    expect(reloads).toBe(0);
  });
});
