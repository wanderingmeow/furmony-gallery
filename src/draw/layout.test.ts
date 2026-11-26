import { describe, expect, it } from "vitest";
import {
  GAP,
  MIN_CARD,
  MIN_COLS,
  RELATED_CARD_GAP,
  RELATED_CARD_MIN,
  VIEW_PAD,
  detailClipHeight,
  detailPictureHeight,
  indexOfRow,
  panelArtWidth,
  panelInfoWidth,
  relatedCardWidth,
  relatedCardsHeight,
  relatedPerView,
  relatedStripHeight,
  renderWindow,
  rowOfIndex,
  type Shape,
  CARD_BAND_PAD,
  cardBands,
  shapeAt,
  sheetCardBox,
  sheetCardOuterW,
  skeletonRows,
  waterfallCardWidth,
  waterfallCols,
  waterfallRowHeight,
} from "./layout";

// Each grid answers two questions: how many cards fit, and how wide each one is. The
// named cases are the widths people actually get - a phone, a small window, and the
// detail sheet at its widest.
describe("related row column math", () => {
  const rowAt = (sheetWidth: number) => {
    const avail = sheetWidth - VIEW_PAD * 2;
    const n = relatedPerView(avail);
    return { n, card: relatedCardWidth(avail, n) };
  };

  it("shows 2 cards on a 430px phone", () => {
    expect(rowAt(430)).toEqual({ n: 2, card: 192 });
  });

  // 760px is the widest the strip ever gets: the sheet stops at sm:max-w-190, so a
  // desktop window does not make the cards wider.
  it("shows 4 cards in a 760px sheet", () => {
    expect(rowAt(760)).toEqual({ n: 4, card: 171 });
  });

  it("shows 3 cards in between", () => {
    expect(rowAt(560)).toEqual({ n: 3, card: 166 });
  });

  it("never squeezes a cover below the floor", () => {
    // at 320px three cards would give 88px each, so the floor wins
    expect(rowAt(320).card).toBe(RELATED_CARD_MIN);
  });

  it("stays between 2 and 4 cards at any width", () => {
    for (let w = 240; w <= 2000; w += 10) {
      const n = relatedPerView(w - VIEW_PAD * 2);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
  });

  // Two outcomes only: the cards fit, or the floor holds them up.
  it("either fits whole cards or sits on the floor", () => {
    for (let avail = 200; avail <= 1400; avail += 1) {
      const n = relatedPerView(avail);
      const card = relatedCardWidth(avail, n);
      expect(
        card * n + RELATED_CARD_GAP * (n - 1) <= avail ||
          card === RELATED_CARD_MIN,
      ).toBe(true);
    }
  });

  // One narrow band shows what that trade costs: a sheet of 517..539px asks for 3 cards,
  // and 3 cards at the floor need 508px. The floor wins, and the row scrolls by the
  // difference - a readable cover beats a whole card too small to judge.
  it("scrolls instead of shrinking below the floor", () => {
    const avail = 490;
    expect(relatedPerView(avail)).toBe(3);
    expect(relatedCardWidth(avail, 3)).toBe(RELATED_CARD_MIN);
    expect(RELATED_CARD_MIN * 3 + RELATED_CARD_GAP * 2 - avail).toBe(18);
  });

  // Measured in the browser on a 430px sheet: 192px wide, 124.45px cover, 24px caption line.
  // The empty strip holds this plus the bar, so the sheet jumps when the number here and
  // a real card's height differ.
  it("matches the height a real card row takes", () => {
    expect(relatedCardsHeight(192)).toBeCloseTo(148.45, 1);
  });

  // This checks the sum. Whether the empty strip uses it is a browser check.
  it("adds the bar and its gap to the cards", () => {
    expect(relatedStripHeight(192)).toBeCloseTo(165.45, 1);
  });

  it("keeps the waterfall floor above the related row floor", () => {
    // a waterfall card carries a name, tags, and a price, so it needs more width than a
    // cover-only card
    expect(MIN_CARD).toBeGreaterThan(RELATED_CARD_MIN);
  });
});

describe("waterfall column math", () => {
  const gridAt = (viewportWidth: number) => {
    const cols = waterfallCols(viewportWidth);
    return { cols, card: waterfallCardWidth(viewportWidth, cols) };
  };

  it("shows 2 columns on a 430px phone", () => {
    expect(gridAt(430)).toEqual({ cols: 2, card: 191 });
  });

  // An unmeasured window is the first frame, and the first frame is a phone.
  it("falls back to 2 columns before the first measure", () => {
    expect(waterfallCols(0)).toBe(MIN_COLS);
  });

  it("adds a column as the window widens", () => {
    expect(waterfallCols(560)).toBe(2);
    expect(waterfallCols(760)).toBe(3);
    expect(waterfallCols(1200)).toBe(4);
  });

  // Card width stays fractional, so the cards and gaps fill the content box exactly and
  // no sliver of padding survives at the right edge.
  it("fills the width with cards and gaps", () => {
    for (let w = 320; w <= 2000; w += 5) {
      const { cols, card } = gridAt(w);
      expect(card * cols + GAP * (cols - 1)).toBeCloseTo(w - 2 * VIEW_PAD, 6);
    }
  });

  it("never draws fewer than 2 columns", () => {
    for (let w = 0; w <= 2400; w += 5) {
      expect(waterfallCols(w)).toBeGreaterThanOrEqual(MIN_COLS);
    }
  });

  // The MIN_CARD promise holds once the grid has room for two such cards. Below that the
  // clamp to 2 columns decides the width, and a phone gets a narrower card.
  it("keeps a card near MIN_CARD once two columns fit", () => {
    for (let w = 520; w <= 2400; w += 5) {
      expect(gridAt(w).card).toBeGreaterThan(MIN_CARD - GAP);
    }
  });

  it("pitches rows one card plus one gap apart", () => {
    const row = waterfallRowHeight(191);
    const card = row - GAP;
    expect(row - card).toBe(GAP);
    // the estimate leaves room under the cover for the price, name, and tag lines
    expect(card).toBeGreaterThan((191 * 597) / 921);
  });

  // The saved scroll position stores an item, and items move between rows whenever the
  // filter changes, so both directions of this pair need to agree.
  it("maps an item to its row and back inside the same row", () => {
    const cols = 3;
    const count = 50;
    for (let i = 0; i < count; i++) {
      const first = indexOfRow(rowOfIndex(i, cols), cols, count);
      expect(first).toBeLessThanOrEqual(i);
      expect(first).toBeGreaterThan(i - cols);
    }
  });

  it("reads a missing item as the first row, and an empty view as no item", () => {
    expect(rowOfIndex(-1, 3)).toBe(0); // findIndex returns -1 when the filter hid the row
    expect(indexOfRow(0, 3, 0)).toBe(-1); // items()[-1] is undefined, and the caller checks
  });
});

// The window is the only place the list decides which rows exist: a negative height or a NaN
// transform there paints nothing, and the user sees a blank list until the browser's own scroll
// clamp lands.
describe("waterfall render window", () => {
  type Window = Parameters<typeof renderWindow>[0];
  const at = (over: Partial<Window> = {}) =>
    renderWindow({
      scrollTop: 900,
      viewport: 800,
      rowHeight: 300,
      rowCount: 100,
      overscan: 2,
      ...over,
    });

  it("paints the rows the window covers plus the overscan on each side", () => {
    expect(at()).toEqual({ firstRow: 3, start: 1, end: 8 });
  });

  it("starts at the first row at the top of the list", () => {
    expect(at({ scrollTop: 0 })).toEqual({ firstRow: 0, start: 0, end: 5 });
  });

  it("stops at the last row when the page is scrolled past the end", () => {
    expect(at({ scrollTop: 99999 })).toEqual({
      firstRow: 100,
      start: 98,
      end: 100,
    });
  });

  it("is an empty window when the list is empty", () => {
    expect(at({ rowCount: 0, scrollTop: 5000 })).toEqual({
      firstRow: 0,
      start: 0,
      end: 0,
    });
  });

  it("is an empty window before the row height is measured", () => {
    expect(at({ rowHeight: 0 })).toEqual({ firstRow: 0, start: 0, end: 0 });
    expect(at({ rowHeight: Number.NaN })).toEqual({
      firstRow: 0,
      start: 0,
      end: 0,
    });
  });

  it("reads a rubber-band offset as the top of the list", () => {
    expect(at({ scrollTop: -80 })).toEqual({ firstRow: 0, start: 0, end: 5 });
  });

  it("never inverts, whatever the numbers", () => {
    for (const rowHeight of [
      0,
      -300,
      0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      for (const rowCount of [0, -4, Number.NaN, 100]) {
        for (const scrollTop of [-500, 0, 900, Number.NaN]) {
          const w = at({ rowHeight, rowCount, scrollTop });
          expect(w.start).toBeLessThanOrEqual(w.end);
          expect(Number.isFinite(w.start) && Number.isFinite(w.end)).toBe(true);
          expect(w.end).toBeLessThanOrEqual(
            Math.max(0, Number.isFinite(rowCount) ? Math.floor(rowCount) : 0),
          );
        }
      }
    }
  });
});

// The placeholder list draws the grid that the real list will use, so it needs the same number of
// rows that a user would see filled: every row that starts above the fold. The cards start
// VIEW_PAD under the bar's bottom edge, which measures 110px.
describe("placeholder row math", () => {
  const topPad = 110 + VIEW_PAD;
  const rowsAt = (viewportWidth: number, viewportHeight: number) => {
    const row = waterfallRowHeight(
      waterfallCardWidth(viewportWidth, waterfallCols(viewportWidth)),
    );
    return skeletonRows(viewportHeight, topPad, row);
  };

  it("fills a 390x844 phone with 4 rows", () => {
    expect(rowsAt(390, 844)).toBe(4);
  });

  it("keeps the row that only shows its top edge", () => {
    // A 390px window's row pitch is 208.5, so the fourth row starts at 126 + 3 * 208.5 = 751.5.
    expect(skeletonRows(752, topPad, 208.5)).toBe(4);
    expect(skeletonRows(751, topPad, 208.5)).toBe(3);
  });

  it("draws one row in landscape, where the fold is shallower than a row", () => {
    expect(rowsAt(844, 390)).toBe(1);
  });

  it("keeps 4 rows on a 21:9 phone, where the extra height is not a whole row", () => {
    expect(rowsAt(390, 910)).toBe(4);
  });

  it("fills a 1280x800 window with 3 rows, and a 2560x1440 one with 6", () => {
    expect(rowsAt(1280, 800)).toBe(3);
    expect(rowsAt(2560, 1440)).toBe(6);
  });

  it("draws a row even when the window is shorter than the bar", () => {
    expect(skeletonRows(100, topPad, 208)).toBe(1);
  });
});

describe("the detail's shape and box", () => {
  // The rule written on `Shape`, screen by screen.
  const screens: [string, number, number, Shape][] = [
    ["a phone held upright", 393, 852, "sheet"],
    ["an iPhone SE sideways", 667, 375, "panel"],
    ["a phone turned sideways", 852, 393, "panel"],
    ["an iPad upright", 834, 1194, "sheet"],
    ["an iPad mini sideways", 1133, 744, "panel"],
    ["an iPad Pro upright", 1024, 1366, "sheet"],
    ["an iPad Pro sideways", 1366, 1024, "panel"],
    ["a laptop window", 1280, 800, "panel"],
    ["a desktop screen", 1920, 1080, "panel"],
    ["a square window", 900, 900, "panel"],
    ["one pixel taller than wide", 900, 901, "sheet"],
    ["the narrowest screen that splits", 640, 400, "panel"],
    ["one pixel narrower", 639, 400, "sheet"],
    ["a phone asking for the desktop layout", 1280, 2600, "sheet"],
    ["taller than any tablet, and still one column", 1024, 1400, "sheet"],
  ];

  it.each(screens)("%s", (_name, w, h, shape) => {
    expect(shapeAt(w, h)).toBe(shape);
  });

  it("stops a sheet's art near its own width, and gives a panel the whole column", () => {
    // A 1:1 picture fills these boxes instead of floating between two side bands.
    expect(
      detailPictureHeight(sheetCardBox(393, 852), "sheet"),
      "a phone",
    ).toBeCloseTo(397.1);
    expect(
      detailPictureHeight(sheetCardBox(1133, 744), "panel"),
      "an iPad mini sideways",
    ).toBe(544);
    expect(
      detailPictureHeight(sheetCardBox(852, 393), "panel"),
      "a phone sideways",
    ).toBe(241);
    expect(
      detailPictureHeight(sheetCardBox(700, 200), "panel"),
      "below this the zoom is how you look at it",
    ).toBe(120);
  });

  // A debut clip is shot standing up, so the ceiling that holds a still to its own
  // width is not asked of it. The half-card ceiling is, and so is the room left once the thumbs and
  // the bar are paid for.
  it("plays a clip at the height a still is refused, under the same half-card ceiling", () => {
    const phone = sheetCardBox(393, 852);
    expect(detailClipHeight(phone, "sheet"), "half the card").toBeCloseTo(
      phone.h * 0.5,
    );
    expect(
      detailClipHeight(phone, "sheet"),
      "taller than the box a still stands at",
    ).toBeGreaterThan(detailPictureHeight(phone, "sheet"));
    // The band a notch costs is paid for before the ceiling is read.
    const notched = sheetCardBox(393, 852, {
      top: 47,
      bottom: 34,
      left: 0,
      right: 0,
    });
    expect(detailClipHeight(notched, "sheet", 47)).toBeLessThan(
      detailClipHeight(phone, "sheet"),
    );
    for (const [w, h, shape] of [
      [393, 852, "sheet"],
      [744, 1133, "sheet"],
      [852, 393, "panel"],
      [1133, 744, "panel"],
    ] as [number, number, Shape][]) {
      const box = sheetCardBox(w, h);
      const clip = detailClipHeight(box, shape);
      if (shape === "sheet")
        expect(clip, `${w}x${h} stays under half the card`).toBeLessThanOrEqual(
          box.h * 0.5,
        );
      expect(
        clip,
        `${w}x${h} ${shape} never shorter than a still`,
      ).toBeGreaterThanOrEqual(detailPictureHeight(box, shape));
    }
  });

  it("holds a sheet's art to half its card", () => {
    // A tablet upright has room for a cover that fills the card, and a user who has to scroll past
    // it to reach the table.
    expect(
      detailPictureHeight(sheetCardBox(744, 1133), "sheet"),
      "an iPad mini upright",
    ).toBeCloseTo(518.5);
    expect(
      detailPictureHeight(sheetCardBox(1024, 1366), "sheet"),
      "an iPad Pro upright",
    ).toBeCloseTo(635);
    // A panel is two columns: the art's column is what it is, and the table stands beside it.
    expect(
      detailPictureHeight(sheetCardBox(1366, 1024), "panel"),
      "a panel's own column",
    ).toBe(776);
  });

  it("caps the art so the table stays on the first screen", () => {
    // The room a sheet has left once its padding, the thumbs and the bar are paid for. A card this
    // short is under the cover's own ceiling, so the room is what decides.
    const box = sheetCardBox(393, 400);
    expect(detailPictureHeight(box, "sheet")).toBe(box.h - 84 - 68 - 61);
  });

  it("keeps the close button's row and the screen's band out of the art's room", () => {
    // On a screen this short the room left for the art is smaller than the art's own width, so the
    // room decides its height. That room pays for the close button's row - 1rem of edge, a 44 tall
    // button, 8 of air - and the screen's band sits on top of it, because the row moves down with
    // the band.
    const flat = { top: 0, right: 0, bottom: 0, left: 0 };
    expect(
      detailPictureHeight(sheetCardBox(393, 400, flat), "sheet", 0),
      "a screen with no band",
    ).toBe(187);
    expect(
      detailPictureHeight(
        sheetCardBox(393, 400, { ...flat, top: 59 }),
        "sheet",
        59,
      ),
      "a notched phone",
    ).toBe(128);
  });

  it("sizes the card the way its classes draw it", () => {
    expect(sheetCardBox(393, 852), "the whole screen below sm").toEqual({
      w: 393,
      h: 852,
    });
    expect(
      sheetCardBox(744, 1133),
      "a wide sheet pays the same gap a panel pays",
    ).toEqual({ w: 648, h: 1037 });
    expect(sheetCardBox(1024, 1366), "and stops at 760 wide").toEqual({
      w: 760,
      h: 1270,
    });
    expect(sheetCardBox(852, 393), "a screen this short keeps no gap").toEqual({
      w: 852,
      h: 393,
    });
    expect(sheetCardBox(1133, 744)).toEqual({ w: 1085, h: 696 });
    expect(sheetCardBox(1366, 1024), "a tall panel keeps a wider gap").toEqual({
      w: 1270,
      h: 928,
    });
  });
});

describe("a panel widens its art column", () => {
  it("grows the card until the art column reaches 3 wide to 2 high", () => {
    const box = sheetCardBox(1680, 1050);
    expect(box).toEqual({ w: 1584, h: 954 });
    expect(detailPictureHeight(box, "panel")).toBe(802);
    expect(panelArtWidth(box.w)).toBe(1108);
  });

  it("stops growing there rather than eating the whole window", () => {
    // the window leaves 1824 for the card; the art reaches 3:2 at 1691 of it
    const box = sheetCardBox(1920, 1080);
    expect(box.w).toBe(1691);
    expect(panelArtWidth(box.w)).toBe(1215);
  });

  it("never grows past the window", () => {
    expect(sheetCardBox(1000, 1000).w).toBe(904);
    expect(sheetCardBox(1133, 744).w).toBe(1085);
  });

  it("keeps the box inside 3 wide to 2 high while it grows", () => {
    for (const [w, h] of [
      [1280, 800],
      [1680, 1050],
      [1920, 1080],
      [1000, 1000],
    ] as const) {
      const box = sheetCardBox(w, h);
      const ratio = panelArtWidth(box.w) / detailPictureHeight(box, "panel");
      expect(ratio, `${w}x${h}`).toBeLessThanOrEqual(1.52);
    }
  });

  it("holds the table column between 260 and 420 however wide the card gets", () => {
    expect(panelInfoWidth(500)).toBe(260);
    expect(panelInfoWidth(828)).toBe(398);
    expect(panelInfoWidth(1080)).toBe(420);
    expect(panelInfoWidth(1584)).toBe(420);
  });

  it("leaves a sheet's 760 alone", () => {
    expect(sheetCardBox(1024, 1366).w).toBe(760);
    expect(sheetCardBox(700, 1133).w).toBe(604);
  });
});

describe("a card on a screen that takes its sides", () => {
  // an iPhone in landscape: the notch is 47 wide at each side and the card keeps no gap
  const NOTCH = { top: 0, right: 47, bottom: 0, left: 47 };

  it("fills the screen and takes the bands inside, instead of shrinking away from them", () => {
    expect(sheetCardOuterW(844, 390, NOTCH)).toBe(844);
    expect(sheetCardBox(844, 390, NOTCH)).toEqual({ w: 750, h: 390 });
  });

  it("leaves the bands out of the card once the gap stands further in than they reach", () => {
    expect(cardBands(0, NOTCH)).toEqual(NOTCH);
    expect(cardBands(20, NOTCH)).toEqual({
      top: 0,
      right: 27,
      bottom: 0,
      left: 27,
    });
    expect(cardBands(48, NOTCH)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("narrows the columns the notch covers, not the card around them", () => {
    // the grid reads the room the card leaves, so 47 at each side costs the art column its share
    expect(panelArtWidth(sheetCardBox(844, 390, NOTCH).w)).toBe(335);
    expect(panelArtWidth(sheetCardBox(844, 390).w)).toBe(382);
  });

  it("measures the same card where the screen gives its sides back", () => {
    expect(sheetCardOuterW(844, 390)).toBe(844);
    expect(sheetCardBox(844, 390).w).toBe(844);
  });
});

describe("the padding the card paints for the screen's sides", () => {
  it("comes from the bands the screen reports, not from a number a script read", () => {
    // iOS answers a turn slowly: a card padding what the script last heard can stand under the island
    expect(CARD_BAND_PAD).toContain("var(--safe-left)");
    expect(CARD_BAND_PAD).toContain("var(--safe-right)");
  });

  it("takes off the gap the card already stands in by", () => {
    expect(CARD_BAND_PAD).toContain("var(--sheet-gap");
    expect(CARD_BAND_PAD).toContain("max(0px,");
  });
});
