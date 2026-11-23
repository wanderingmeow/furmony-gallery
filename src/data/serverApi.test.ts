import { describe, expect, it } from "vitest";
import { PATH, SERVER_ORIGIN, serverOrigin, serverUrl } from "./serverApi";

describe("serverOrigin", () => {
  it("takes an https host with a dot in it", () => {
    expect(serverOrigin("https://search.invalid")).toBe(
      "https://search.invalid",
    );
  });

  it("accepts the address with a trailing slash or spaces around it", () => {
    expect(serverOrigin("  https://search.invalid/  ")).toBe(
      "https://search.invalid",
    );
  });

  it("refuses an address that still carries a path, a query or a port", () => {
    expect(serverOrigin("https://search.invalid/search")).toBe("");
    expect(serverOrigin("https://search.invalid/api/v1")).toBe("");
    expect(serverOrigin("https://search.invalid?q=1")).toBe("");
  });

  it("refuses a plain address, a host without a dot, and nothing at all", () => {
    expect(serverOrigin("http://search.invalid")).toBe("");
    expect(serverOrigin("https://localhost")).toBe("");
    expect(serverOrigin("")).toBe("");
  });
});

describe("serverUrl", () => {
  it("puts each path beside the origin this build was given", () => {
    expect(SERVER_ORIGIN).toBe("https://search.invalid");
    expect(serverUrl(PATH.search)).toBe("https://search.invalid/search");
    expect(serverUrl(PATH.searchPicture)).toBe(
      "https://search.invalid/search-image",
    );
    expect(serverUrl(PATH.ping)).toBe("https://search.invalid/ping");
  });

  it("names every path with a leading slash, so no call can reach the origin root", () => {
    for (const path of Object.values(PATH))
      expect(path.startsWith("/")).toBe(true);
  });
});
