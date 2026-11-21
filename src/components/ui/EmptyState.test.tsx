// The box draws the reason the store named, and the button the reader presses. Which reason gets
// chosen is tested in model/emptyState.test.ts, and the facts that feed it in
// stores/derivedStore.test.ts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { EmptyState } from "./EmptyState";
import type {
  EmptyAction,
  EmptyIcon,
  EmptyState as EmptyChoice,
} from "../../model/emptyState";

const shown = vi.hoisted(() => ({ state: null as EmptyChoice | null }));
const calls = vi.hoisted(() => [] as EmptyAction[]);

// The box never touches the router: every action is a store call.
vi.mock("../../stores/derivedStore", () => ({
  emptyState: () => shown.state,
  applyEmptyAction: (action: EmptyAction) => {
    calls.push(action);
  },
}));

const reason = (
  icon: EmptyIcon,
  title: string,
  over: Partial<Pick<EmptyChoice, "line" | "action">> = {},
): EmptyChoice => ({ icon, title, ...over });

let host: HTMLDivElement;
let dispose: (() => void) | undefined;

function draw(state: EmptyChoice | null): void {
  shown.state = state;
  calls.length = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(() => <EmptyState />, host);
}

const words = () => host.textContent ?? "";
const press = () =>
  host
    .querySelector("button")!
    .dispatchEvent(new MouseEvent("click", { bubbles: true }));

afterEach(() => {
  dispose?.();
  host?.remove();
});

describe("EmptyState", () => {
  it("draws the icon, the title and the line it was given", () => {
    draw(
      reason("search", "没有「机械狼」相关设定", {
        line: "换个词试试",
        action: "search",
      }),
    );
    expect(words()).toContain("没有「机械狼」相关设定");
    expect(words()).toContain("换个词试试");
    expect(host.querySelector("svg")).not.toBe(null);
  });

  it("presses the one action the reason names", () => {
    draw(reason("search", "没有「机械狼」相关设定", { action: "search" }));
    press();
    expect(calls).toEqual(["search"]);
  });

  it("names the 主人账号 action by what it does", () => {
    draw(reason("filter", "没有查到主人账号的设定", { action: "socialOnly" }));
    expect(words()).toContain("关闭该筛选");
    press();
    expect(calls).toEqual(["socialOnly"]);
  });

  it("shows no button when there is nothing to press", () => {
    draw(reason("heart", "还没有收藏"));
    expect(words()).toBe("还没有收藏");
    expect(host.querySelector("button")).toBe(null);
  });

  it("keeps the box on the page with no reason to show", () => {
    draw(null);
    expect(words()).toBe("");
    expect(host.querySelector("div")).not.toBe(null);
  });
});
