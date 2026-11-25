import { describe, expect, test } from "vitest";
import { serviceWorkerAddress } from "./serviceWorker";

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
