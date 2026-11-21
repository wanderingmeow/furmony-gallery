// The one place the app hands the shelf's words to someone else. What matters here is that the
// wire shape is what the endpoint answers, that the shape of the paragraph survives the round
// trip, and that a paragraph already translated is not sent out twice.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Module = typeof import("./translateText");

let mod: Module;
let sent: { sections: string[]; target: string }[];
let reply: (sections: string[]) => string[] | null;

beforeEach(async () => {
  vi.resetModules();
  sent = [];
  reply = (sections) => sections.map((line) => `[${line}]`);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const sections: string[] = body[0][0];
      const target: string = body[0][2];
      sent.push({ sections, target });
      const out = reply(sections);
      return out === null
        ? { ok: false, status: 503 }
        : { ok: true, json: async () => [out] };
    }),
  );
  mod = await import("./translateText");
});

describe("translateProse", () => {
  it("sends the shape the widget sends", async () => {
    await mod.translateProse("一段编的文字", "en");
    expect(sent[0].target).toBe("en");
    // The tail carries the client tag; without it the endpoint calls the body invalid.
    const raw = JSON.parse(
      String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body),
    );
    expect(raw[1]).toBe("te");
    expect(raw[2]).toBeNull();
    expect(raw[3]).toBe(1);
  });

  it("keeps the lines the paragraph was written in", async () => {
    reply = (sections) => sections;
    const out = await mod.translateProse("第一行\n第二行\n第三行", "en");
    expect(out.split("\n")).toHaveLength(3);
    expect(out).toBe("第一行\n第二行\n第三行");
  });

  it("sends one section per paragraph, whole", async () => {
    reply = (sections) => sections;
    await mod.translateProse("第一段。\n\n第三段。", "ja");
    expect(sent[0].sections, "a paragraph goes as it is written").toEqual([
      "第一段。",
      "",
      "第三段。",
    ]);
  });

  it("puts a space where the endpoint copied the Chinese spacing", async () => {
    reply = () => [
      "Made-up line one.Made-up line two.I wrote a third,watching.",
    ];
    const out = await mod.translateProse(
      "编的第一句。编的第二句。编的第三句。",
      "en",
    );
    expect(out).toBe(
      "Made-up line one. Made-up line two. I wrote a third, watching.",
    );
    reply = () => ["编号 3.5 不变。"];
    expect(await mod.translateProse("编号 3.5 不变。", "en")).toBe(
      "编号 3.5 不变。",
    );
  });

  it("escapes markup out and unescapes it back", async () => {
    // The endpoint answers with the entities still in place, which is what the widget sends back.
    reply = (sections) => sections;
    const out = await mod.translateProse("符号 A&B 与 <标签> 都要回来", "en");
    expect(out).toContain("A&B");
    expect(out).toContain("<标签>");
  });

  it("answers a paragraph already translated from the cache", async () => {
    await mod.translateProse("一段编的文字", "en");
    await mod.translateProse("一段编的文字", "en");
    expect(sent).toHaveLength(1);
  });

  it("keeps one entry per language", async () => {
    await mod.translateProse("一段编的文字", "en");
    await mod.translateProse("一段编的文字", "ja");
    expect(sent).toHaveLength(2);
    await mod.translateProse("一段编的文字", "en");
    expect(sent).toHaveLength(2);
  });

  it("drops the least recently used answer when the shelf fills up", async () => {
    const size = 40;
    for (let i = 0; i < size; i++)
      await mod.translateProse(`第 ${i} 段设定介绍`, "en");
    expect(sent).toHaveLength(size);

    // Touch the oldest so it is the newest, then push one fewer paragraph than the cache holds.
    await mod.translateProse("第 0 段设定介绍", "en");
    expect(sent).toHaveLength(size);
    for (let i = size; i < size * 2 - 1; i++)
      await mod.translateProse(`第 ${i} 段设定介绍`, "en");

    await mod.translateProse("第 0 段设定介绍", "en");
    expect(
      sent,
      "the one that was used most recently is still there",
    ).toHaveLength(size * 2 - 1);
    await mod.translateProse("第 1 段设定介绍", "en");
    expect(sent, "the one nobody touched got dropped").toHaveLength(size * 2);
  });

  it("does not remember a failure", async () => {
    reply = () => null;
    await expect(mod.translateProse("一段编的文字", "en")).rejects.toThrow();
    expect(sent).toHaveLength(1);
    reply = (sections) => sections;
    await mod.translateProse("一段编的文字", "en");
    expect(sent).toHaveLength(2);
  });

  it("stops when the caller calls the request off", async () => {
    const giveUp = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            sent.push({ sections: [], target: "" });
            init.signal?.addEventListener("abort", () =>
              reject(new Error("called off")),
            );
          }),
      ),
    );
    const out = mod.translateProse("一段编的文字", "en", giveUp.signal);
    expect(sent, "the request went out").toHaveLength(1);
    giveUp.abort();
    await expect(out).rejects.toThrow("called off");
  });

  it("gives up on a request that never answers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      ),
    );
    const settled = vi.fn();
    mod.translateProse("一段编的文字", "en").catch(settled);
    await vi.advanceTimersByTimeAsync(7000);
    expect(
      settled,
      "a patient reader waits, but not forever",
    ).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(
      settled,
      "the row falls back to what the shelf answered",
    ).toHaveBeenCalledWith(expect.any(Error));
    vi.useRealTimers();
  });

  it("rejects an answer that lost a section on the way", async () => {
    reply = () => ["只有一段"];
    await expect(mod.translateProse("第一行\n第二行", "en")).rejects.toThrow();
  });
});
