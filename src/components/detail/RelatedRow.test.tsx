// A related card has to push a history entry naming the listing that the reader came from. The
// row is otherwise layout and pictures, so the router and the stores are stood in for here.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import type { AdoptListing } from "../../model/types";
import { RelatedRow } from "./RelatedRow";

// vi.mock factories run while this file's imports resolve, so the values they hand over come
// from vi.hoisted, which lands above those imports.
const { navigate, listings, first, neighbors, table } = vi.hoisted(() => {
  const neighbors = [2, 3, 4, 5];
  const table = { ids: neighbors };
  const listings = [1, ...neighbors].map((id) => ({
    adoptId: id,
    adoptName: `设定 ${id}`,
    paintersId: 1,
    productId: 1,
    adoptPicture: `https://bucket.cos.ap-guangzhou.myqcloud.com/cover-${id}.png`,
    adoptHeadPicture: `https://bucket.cos.ap-guangzhou.myqcloud.com/head-${id}.png`,
  })) as AdoptListing[];
  return { navigate: vi.fn(), listings, first: listings[0], neighbors, table };
});

vi.mock("@solidjs/router", () => ({ useNavigate: () => navigate }));

vi.mock("../../stores/listingsStore", () => ({
  listings: () => listings,
}));
vi.mock("../../stores/relatedStore", () => ({
  related: () => ({
    topN: table.ids.length,
    neighbors: new Map([[1, table.ids]]),
  }),
  relatedLoaded: () => true,
  loadRelated: () => Promise.resolve(),
}));
vi.mock("../../stores/displayStore", () => ({
  relatedOnlyUnlocked: () => false,
  setRelatedOnlyUnlocked: () => {},
}));

let dispose: (() => void) | undefined;
let host: HTMLDivElement;

function mount(): void {
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(() => <RelatedRow item={first} shape="sheet" />, host);
}

const card = (id: number) =>
  host.querySelector<HTMLElement>(`button[aria-label^="看 #${id} "]`);

afterEach(() => {
  table.ids = neighbors;
  vi.clearAllMocks();
  dispose?.();
  host.remove();
});

describe("how many neighbors the row needs", () => {
  // A piece can genuinely have one neighbor: hiding a single one hides the only way deeper.
  it("shows the row for a single neighbor", () => {
    table.ids = [2];
    mount();
    expect(card(2)).toBeTruthy();
  });

  it("hides the row when nothing resolves to a listing", () => {
    table.ids = [999];
    mount();
    expect(host.querySelector("section")).toBeNull();
  });
});

describe("tapping a related card", () => {
  it("shows one card per neighbor", () => {
    mount();
    expect(neighbors.every((id) => card(id))).toBe(true);
  });

  it("pushes an entry naming the listing it came from", () => {
    mount();
    card(3)!.click();
    // The whole options object is compared, so a `replace` flag would fail here.
    expect(navigate).toHaveBeenCalledWith("/detail/3", {
      scroll: false,
      state: { fromDetail: 1 },
    });
  });
});
