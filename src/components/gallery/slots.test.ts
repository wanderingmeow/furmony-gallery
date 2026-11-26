// The squares a gallery swipes through: the studio's own art, the debut's clip, and the album of
// the debut day. The clip's place is a number, and a wrong number is a gallery that reads in the
// wrong order, so the order is what these tests hold.
import { describe, expect, it } from "vitest";
import { gallerySlots, type ClipSlot } from "./slots";

const ART = [
  "https://cdn.example.invalid/one.jpg",
  "https://cdn.example.invalid/two.jpg",
];
const COPIES = ["https://cdn.example.invalid/one.small.jpg"];
const CLIP: Omit<ClipSlot, "kind"> = {
  url: "https://cdn.example.invalid/cover.jpg",
  thumb: "https://cdn.example.invalid/cover.small.jpg",
  clip: {
    bv: "BV0000000000",
    cover: "https://cdn.example.invalid/cover.jpg",
    seconds: 18,
  },
};

const order = (
  urls: string[],
  thumbs: string[],
  clip?: Omit<ClipSlot, "kind">,
  after?: number,
) => gallerySlots(urls, thumbs, clip, after).map((one) => one.kind);

describe("the squares a gallery swipes through", () => {
  it("lists the pictures alone when the listing has no clip", () => {
    expect(order(ART, COPIES)).toEqual(["pic", "pic"]);
  });

  it("numbers each picture by its place in the album", () => {
    const squares = gallerySlots(ART, COPIES);
    expect(squares.map((one) => one.kind === "pic" && one.pic)).toEqual([0, 1]);
  });

  it("sends a picture with no small copy for its own address", () => {
    const second = gallerySlots(ART, COPIES)[1];
    expect(second.kind === "pic" && second.thumb).toBe(ART[1]);
  });

  it("keeps the small copy that was written for a picture", () => {
    const first = gallerySlots(ART, COPIES)[0];
    expect(first.kind === "pic" && first.thumb).toBe(COPIES[0]);
  });

  it("stands the clip first when the studio's own art reaches no picture", () => {
    expect(order(ART, COPIES, CLIP, 0)).toEqual(["clip", "pic", "pic"]);
  });

  it("stands the clip among the pictures it is asked to follow", () => {
    expect(order(ART, COPIES, CLIP, 1)).toEqual(["pic", "clip", "pic"]);
  });

  it("stands the clip last when asked to follow more pictures than there are", () => {
    expect(order(ART, COPIES, CLIP, 9)).toEqual(["pic", "pic", "clip"]);
  });

  it("stands the clip first when asked to follow a negative count", () => {
    expect(order(ART, COPIES, CLIP, -3)).toEqual(["clip", "pic", "pic"]);
  });

  it("holds the clip's own cover and small copy in its square", () => {
    const [square] = gallerySlots(ART, COPIES, CLIP, 0);
    expect(square.kind === "clip" && square.url).toBe(CLIP.url);
    expect(square.kind === "clip" && square.thumb).toBe(CLIP.thumb);
  });

  it("stands one clip square for a listing with no pictures at all", () => {
    expect(order([], [], CLIP, 0)).toEqual(["clip"]);
  });
});
