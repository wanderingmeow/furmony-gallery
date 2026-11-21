import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { settled } from "../../testSetup";
import { PictureMode } from "./PictureSearch";
import { setSemanticSearch } from "../../stores/displayStore";
const sent = vi.hoisted(() => ({
  answer: null as unknown,
  uploaded: null as (() => void) | null,
  encodeGate: null as Promise<void> | null,
}));

vi.mock("../../data/searchApi", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../data/searchApi")>();
  return {
    ...real,
    searchConfigured: true,
    askPicture: (_blob: Blob, signal: AbortSignal, onUploaded?: () => void) =>
      new Promise((resolve) => {
        sent.uploaded = onUploaded ?? null;
        signal.addEventListener("abort", () => resolve(null));
        void (sent.answer as Promise<unknown> | null)?.then(resolve);
      }),
  };
});

// The canvas work belongs to the browser; the row only needs the bytes to come back.
vi.mock("../../data/pictureInput", () => ({
  prepare: async (file: Blob) => {
    if (sent.encodeGate) await sent.encodeGate;
    return { blob: file };
  },
}));

const { picture } = await import("../../stores/semanticStore");

let disposeApp: () => void;
let host: HTMLDivElement;

const text = () => (host.textContent ?? "").replace(/\s+/g, "");
const pressableLabels = () =>
  Array.from(host.querySelectorAll("button")).map(
    (b) => b.getAttribute("aria-label") ?? (b.textContent ?? "").trim(),
  );
const spinning = () => !!host.querySelector(".spark-pulse svg");

async function answerWith(body: unknown): Promise<void> {
  sent.answer = Promise.resolve(body);
  void picture.stage(new Blob(["x"], { type: "image/jpeg" }));
  await settled();
  await settled();
}

beforeEach(() => {
  sent.answer = null;
  sent.uploaded = null;
  sent.encodeGate = null;
  picture.close();
  setSemanticSearch(true);
  host = document.createElement("div");
  document.body.appendChild(host);
  disposeApp = render(() => <PictureMode />, host);
});

afterEach(() => {
  disposeApp();
  host.remove();
  picture.close();
  setSemanticSearch(false);
});

describe("the picture row", () => {
  it("shows the drop zone before any picture", () => {
    expect(text()).toContain("是哪一只毛毛？上传就知道");
    expect(pressableLabels()).toHaveLength(1);
    expect(spinning()).toBe(false);
  });

  it("says 加载中 while the browser reads the picture", async () => {
    let release = () => {};
    sent.encodeGate = new Promise<void>((done) => {
      release = done;
    });
    void picture.stage(new Blob(["x"], { type: "image/jpeg" }));
    await settled();
    expect(text()).toContain("加载中");
    expect(spinning()).toBe(true);
    release();
    await settled();
    expect(text()).toContain("上传中");
  });

  it("moves from 上传中 to 查找中 once the bytes have left", async () => {
    sent.answer = new Promise(() => {});
    void picture.stage(new Blob(["x"], { type: "image/jpeg" }));
    await settled();
    await settled();
    expect(text()).toContain("上传中");
    sent.uploaded?.();
    await settled();
    expect(text()).toContain("查找中");
    expect(spinning()).toBe(true);
  });

  it("names the answer, and stops spinning for it", async () => {
    await answerWith({ ids: [201], box: [0.25, 0.25, 0.5, 0.5] });
    expect(text()).toContain("视觉匹配结果");
    expect(spinning()).toBe(false);
    expect(pressableLabels()).toEqual(["换一张"]);
  });

  it("offers 换一张 and not 重试 when nothing matched", async () => {
    await answerWith({ ids: [], box: null });
    expect(text()).toContain("没有很像的");
    expect(pressableLabels()).toEqual(["换一张", "换一张"]);
  });

  it("offers 重试 for a reason that could pass next time", async () => {
    await answerWith({ ids: [], box: null, error: "network", action: "retry" });
    expect(text()).toContain("没连上服务");
    expect(pressableLabels()).toEqual(["换一张", "重试"]);
  });

  it("keeps a word it was not taught, and offers no button with it", async () => {
    await answerWith({ ids: [], box: null, error: "from-a-newer-service" });
    expect(text()).toContain("没搜成");
    expect(pressableLabels()).toEqual(["换一张"]);
  });

  it("says 稍后再试 while the service holds its one upload slot", async () => {
    await answerWith({ ids: [], box: null, busy: true });
    expect(text()).toContain("稍后再试");
    expect(pressableLabels()).toEqual(["换一张"]);
  });
});
