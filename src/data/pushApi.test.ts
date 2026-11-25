import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALL_PUSH_ON,
  applicationKeyOf,
  joinAnswer,
  leaveAnswer,
  postTo,
  readAnswer,
  readBody,
  readFrom,
  subscribeBody,
  tripleOf,
  unsubscribeBody,
} from "./pushApi";

// A real P-256 point in the form the build hands this file: base64 of the base64.
const POINT =
  "BGzLrgJVJNp14mWZkhbYA9ynZdepHl3yMCm897Sq3trJdjud8SoposJAb3YYBp2c0+gIBAmETGKgL6nPyPOx+tU=";
const ENCODED = btoa(POINT);

const READ = "https://service.test/subscription";
const READ_EP = "https://updates.push.services.mozilla.com/wpush/v2/BBB";

const triple = {
  endpoint: "https://updates.push.services.mozilla.com/wpush/v2/AAA",
  p256dh: "BP-key",
  auth: "an-auth",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function spyFetch(reply: () => Response) {
  const seen: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", (url: unknown, init?: RequestInit) => {
    seen.push({ url: String(url), init });
    return Promise.resolve(reply());
  });
  return seen;
}

describe("what the record says about this browser", () => {
  it("asks for the record with the handle and nothing else", () => {
    // Key material in a read would make it a write, and this route is only worth having because it
    // cannot change the row.
    expect(readBody(READ_EP)).toEqual({ endpoint: READ_EP, read: true });
  });

  it("reads a row as the picks a round will send from", () => {
    const said = readAnswer(200, {
      ok: true,
      known: true,
      prefs: { new: false },
      lang: "zh-Hans",
      pending: true,
    });
    expect(said).toEqual({
      at: "held",
      prefs: { new: false, lock: true },
      lang: "zh-Hans",
      pending: true,
    });
  });

  it("reads a pick the row never wrote as on, which is how the service reads one", () => {
    const said = readAnswer(200, { known: true, prefs: {} });
    expect(said.at === "held" && said.prefs).toEqual(ALL_PUSH_ON);
  });

  it("reads an address the service has never heard of as one to offer again", () => {
    expect(readAnswer(200, { ok: true, known: false })).toEqual({
      at: "absent",
    });
  });

  it("reads a refusal as nothing learned, not as a row that is missing", () => {
    // A 400 and a `known: false` ask for opposite things: one means the page sent a broken body,
    // the other means the address should be offered again.
    expect(readAnswer(400, { error: "bad_endpoint" })).toEqual({ at: "quiet" });
    expect(readAnswer(200, {})).toEqual({ at: "quiet" });
  });

  it("sends the read to the address it was given, and posts the handle in the body", async () => {
    const seen = spyFetch(() => Response.json({ ok: true, known: false }));
    expect(await readFrom(READ, READ_EP)).toEqual({ at: "absent" });
    expect(seen[0].url).toBe(READ);
    expect(JSON.parse(String(seen[0].init?.body))).toEqual({
      endpoint: READ_EP,
      read: true,
    });
  });

  it("calls a service that never answered quiet rather than absent", async () => {
    // Absent would make the page re-offer an address that may well be stored, against a service
    // that is simply down.
    const said = await readFrom("", READ_EP);
    expect(said).toEqual({ at: "quiet" });
  });
});

describe("the key the browser checks a notification against", () => {
  it("takes the site's own key as 65 bytes", () => {
    expect(applicationKeyOf(ENCODED)?.length).toBe(65);
  });

  it("refuses a value that is not a point on the curve", () => {
    expect(applicationKeyOf("")).toBeNull();
    expect(applicationKeyOf(btoa("short"))).toBeNull();
    expect(applicationKeyOf(btoa("not base64 at all !!"))).toBeNull();
    expect(applicationKeyOf(btoa("x".repeat(64)))).toBeNull();
    expect(applicationKeyOf(btoa("x".repeat(66)))).toBeNull();
  });
});

describe("the body the service takes", () => {
  it("carries the three keys, the picks, and the page's own language id", () => {
    expect(subscribeBody(triple, { new: true, lock: false }, "zh_tw")).toEqual({
      endpoint: triple.endpoint,
      p256dh: "BP-key",
      auth: "an-auth",
      prefs: { new: true, lock: false },
      lang: "zh_tw",
    });
  });

  it("keeps a copy of the picks, so a later change does not rewrite a request in flight", () => {
    const prefs = { ...ALL_PUSH_ON };
    const body = subscribeBody(triple, prefs, "zh");
    prefs.lock = false;
    expect((body.prefs as typeof prefs).lock).toBe(true);
  });

  it("asks to leave with the endpoint alone", () => {
    expect(unsubscribeBody(triple.endpoint)).toEqual({
      endpoint: triple.endpoint,
      unsubscribe: true,
    });
  });

  it("reads the three keys out of what the browser holds", () => {
    const sub = {
      endpoint: triple.endpoint,
      toJSON: () => ({ keys: { p256dh: "BP-key", auth: "an-auth" } }),
    } as unknown as PushSubscription;
    expect(tripleOf(sub)).toEqual(triple);
  });

  it("says the keys are missing rather than throwing when the browser withholds them", () => {
    const sub = {
      endpoint: triple.endpoint,
      toJSON: () => ({}),
    } as unknown as PushSubscription;
    expect(tripleOf(sub)).toEqual({
      endpoint: triple.endpoint,
      p256dh: "",
      auth: "",
    });
  });
});

describe("what the service said", () => {
  it("tells a delivered first notification from a stored address", () => {
    expect(joinAnswer(200, {})).toBe("live");
    expect(joinAnswer(200, { ok: true, pending: true })).toBe("pending");
  });

  it("takes a provider that does not know the endpoint as a reason to go back off", () => {
    expect(joinAnswer(400, { ok: false, error: "provider_rejected" })).toBe(
      "rejected",
    );
  });

  it("takes a rate limit and a service without a key as themselves", () => {
    expect(joinAnswer(429, null)).toBe("busy");
    expect(joinAnswer(503, { ok: false, error: "no_vapid_key" })).toBe(
      "silent",
    );
  });

  it("reads anything else as a body this file built wrong", () => {
    expect(joinAnswer(500, null)).toBe("malformed");
    expect(joinAnswer(404, null)).toBe("malformed");
  });

  it("takes any answer to a departure as agreement, except silence", () => {
    expect(leaveAnswer(200)).toBe("gone");
    expect(leaveAnswer(429)).toBe("busy");
    expect(leaveAnswer(500)).toBe("unreachable");
  });
});

describe("the call itself", () => {
  it("sends nothing when this build has no address", async () => {
    const seen = spyFetch(() => new Response("{}"));
    expect(await postTo("", subscribeBody(triple, ALL_PUSH_ON, "zh"))).toBe(
      "silent",
    );
    expect(seen).toEqual([]);
  });

  it("posts the body as json", async () => {
    const seen = spyFetch(() => new Response(JSON.stringify({ ok: true })));
    const body = subscribeBody(triple, ALL_PUSH_ON, "ja");
    expect(await postTo("https://svc.invalid/subscribe", body)).toBe("live");
    expect(seen[0].url).toBe("https://svc.invalid/subscribe");
    expect(seen[0].init?.method).toBe("POST");
    expect(
      (seen[0].init?.headers as Record<string, string>)["content-type"],
    ).toBe("application/json");
    expect(JSON.parse(String(seen[0].init?.body))).toEqual(body);
  });

  it("reads a stored address as pending, not as delivered", async () => {
    spyFetch(() => new Response(JSON.stringify({ ok: true, pending: true })));
    expect(
      await postTo(
        "https://svc.invalid/subscribe",
        subscribeBody(triple, ALL_PUSH_ON, "zh"),
      ),
    ).toBe("pending");
  });

  it("reads a departure by its own answer", async () => {
    spyFetch(() => new Response(JSON.stringify({ ok: true })));
    expect(
      await postTo(
        "https://svc.invalid/subscribe",
        unsubscribeBody(triple.endpoint),
      ),
    ).toBe("gone");
  });

  it("says nothing was learned when nothing answered", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("no route")));
    expect(
      await postTo(
        "https://svc.invalid/subscribe",
        subscribeBody(triple, ALL_PUSH_ON, "zh"),
      ),
    ).toBe("unreachable");
  });

  it("answers a body that is not json as a stored address at worst", async () => {
    spyFetch(() => new Response("<html>"));
    expect(
      await postTo(
        "https://svc.invalid/subscribe",
        subscribeBody(triple, ALL_PUSH_ON, "zh"),
      ),
    ).toBe("live");
  });
});
