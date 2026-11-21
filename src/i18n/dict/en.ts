// English. The key tree is the one in `zh.ts`, and the type makes a missing key a compile error.
import type { Dict } from "./shape";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** English needs the singular for one thing. Pass `many` when the plural is not `one` + "s". */
const countOf = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`;

export const en: Dict = {
  common: {
    retry: "Retry",
    close: "Close",
    unknown: "Unknown",
    loading: "Loading…",
    listing: "listing",
    back: "Back",
  },

  tab: {
    all: "All",
    unlocked: "Open",
    locked: "Locked",
    wish: "Liked",
  },

  sort: {
    priceAsc: "Price, low to high",
    priceDesc: "Price, high to low",
    timeAsc: "Oldest first",
    timeDesc: "Newest first",
    similarity: "Most similar first",
    price: "Price",
    time: "Time",
    title: (mode: string) => `Sort: ${mode}`,
  },

  filter: {
    tabGroup: "Category",
    colors: "Colors",
    races: "Species",
    priceMode: "Price display",
    enhance: "Enhanced search",
    reset: "Reset",
    language: "Language",
    sort: "Sort",
    enhanceNote:
      "Search by meaning and by picture runs on an embedding model. The words and pictures you search with go to the server, and the server keeps no data.",
    socialOnly: "Owner account only",
    socialNote: (n: number) =>
      `Only ${countOf(n, "listing")} ${n === 1 ? "has" : "have"} an owner account, so the list gets much shorter.`,
    socialMissing:
      "Owner accounts did not load, so this filter is unavailable for now.",
    onlyUnlocked: "Unlocked only",
    priceRange: "Price range",
    priceMin: "Lowest price",
    priceMax: "Highest price",
    /** How many rows the band holds, under the slider. */
    bandCount: (n: number) => countOf(n, "listing"),
  },

  price: {
    once: "Pay once",
    installment: "12 months",
    hidden: "Hidden",
    noPrice: "No price",
  },

  detail: {
    fields: "Listing details",
    /** The counter reads as a sentence: a bare 1 / 2 says nothing about pictures. */
    photoOf: (n: number, total: number) => `Picture ${n} of ${total}`,
    owner: "Owner",
    painter: "Painter",
    painterNumbered: (n: number) => `Painter ${n}`,
    race: "Race",
    color: "Color",
    status: "Status",
    deposit: "Deposit",
    /** `createTime` on the record: the day the listing was posted. "Created" leaves open whose
     *  date it is. */
    created: "Listed",
    updated: "Updated",
    note: "Notes",
    description: "Description",
    translate: "Machine-translate this description",
    showOriginal: "Show the original",
    translatedNote: "Machine translation",
    lockedNow: "Lock in progress",
    locked: "Locked",
    unlocked: "Open",
    adopted: "Adopted",
    unadopted: "Not adopted",
    notFound: "No such listing",
    goOfficial: "Official site",
  },

  card: {
    wish: "Like",
    wished: "Liked",
    locked: "Locked",
    /** Shorter than the words on the detail page, because a card leaves the price row barely 150px
     *  wide and the tags are meant to have some of it. */
    downPayment: "Down",
    monthly: "Monthly",
  },

  chrome: {
    toTop: "Back to top",
    stats: "Statistics",
  },

  search: {
    placeholder: "Search name, description or ID",
    placeholderEnhanced: "a small dragon that loves meat",
    examples:
      "a small dragon that loves meat | a white fox in the snow | a glowing night dragon | a lamb in a wolf skin | a Halloween trickster | a lab escapee | a dog with a night lamp",
    clear: "Clear search",
    open: "Search",
    close: "Close search",
  },

  picture: {
    find: "Find similar",
    failed: "No search",
    unreadable: "This picture could not be read",
    heic: "This browser cannot decode HEIC photos",
    tooBig: "This picture is too large",
    noAnswer: "The service did not answer",
    offline: "Could not reach the service",
    timeout: "It took too long",
    change: "Pick another",
    uploading: "Uploading",
    searching: "Searching",
    dropHint: "Drop a picture, paste one, or tap to choose",
    later: "Try again in a moment",
    matchTitle: "Matched by picture",
    question: "Which fluff is this? Upload and find out",
    hint: "A convention snapshot or a design sheet both work",
  },

  zoom: {
    close: "Close the large picture",
    in: "Zoom in",
    out: "Zoom out",
  },

  related: {
    title: "Similar listings",
    loading: "Loading similar listings",
    onlyUnlockedShort: "Open only",
    noneUnlocked: "No open listing looks like this one",
    open: (id: number, name: string) => `View #${id} ${name}`,
  },

  notify: {
    locked: "Locked",
    unlocked: "Unlocked",
    priceUp: "↑ Price up",
    priceDown: "↓ Price down",
    dismiss: "Dismiss",
    expand: (n: number) => `Show ${countOf(n, "notification")}`,
    title: "Changes",
    collapse: "Collapse",
  },

  stats: {
    lockState: "Lock state",
    onceDistribution: "One payment prices",
    colorDistribution: "Colors",
    raceDistribution: "Species",
    monthAvg: "Average price of new listings per month",
    monthCount: "New listings per month",
    axisCount: "Count",
    axisAvg: "Average",
    count: (n: number) => countOf(n, "listing"),
    times: (n: number) => countOf(n, "time", "times"),
    totalTimes: (n: number) => `${countOf(n, "appearance")} in total`,
    totalListings: (n: number) => `${countOf(n, "listing")} in total`,
    months: (n: number) => `${countOf(n, "month")} in total`,
    avgMedian: (avg: string, median: string) =>
      `Mean ${avg} | Median ${median}`,
    band: (low: string, high: string, count: number) =>
      `${low}-${high}: ${countOf(count, "listing")}`,
    monthLabel: (year: number, month: number) => `${MONTHS[month - 1]} ${year}`,
    noData: "No data",
  },

  empty: {
    fetchFailedTitle: "The listings did not load",
    fetchFailedAction: "Several attempts, and nothing came back",
    noSocialTitle: "No listing with an owner account",
    noWishTitle: "Nothing saved yet",
    pictureFailedTitle: "No results",
    pictureFailedAction: "Try another picture, or retry in a moment",
    pictureNoneTitle: "Nothing close enough",
    pictureNoneAction: "Try a different picture",
    enhanceFailedTitle: "Enhanced search failed",
    enhanceFailedLine: "Matching by text found nothing either",
    filtersTitle: "No listings match these filters",
    queryTitle: (query: string) => `Nothing matches "${query}"`,
    queryLine: "Try another wording",
    nothingTitle: "Nothing to show",
    nothingAction: "Try again in a moment, or visit the official site",
    clearSearch: "Clear search",
    clearFilters: "Clear filters",
    closeFilter: "Turn this filter off",
  },

  info: {
    /** The money paid first, which is the number a user decides on. */
    downPayment: "Deposit",
    monthly: "Per month",
    periods: (n: number) => `× ${countOf(n, "month")}`,
    total: (price: string) => `${price} in total`,
    /** The price a listing came down from. Read as part of the discount, not as a second price. */
    original: "Original price",
    /** Chinese 折 names the part of the price left to pay, so it becomes a percentage here. */
    discount: (tenths: number) => `${Math.round((10 - tenths) * 10)}% off`,
  },

  band: {
    copyright:
      "All artwork and text come from Furmony (furmony.com), and copyright stays with the original creators. This page is for browsing only and is not used commercially.",
    codeBefore: "The code is open source under the",
    license: "MIT License",
    codeAfter: "",
    repository: "Repository",
  },

  money: {
    /** English groups the digits by thousands and takes the ¥ 简体中文 already uses, which leaves
     *  room on a card for the tags beside the price. */
    amount: (n: number) => `¥${n.toLocaleString("en-US")}`,
  },

  brand: {
    /** The names these platforms write for themselves in this language. */
    douyin: "Douyin",
    xiaohongshu: "Xiaohongshu",
  },

  error: {
    /** The banner at the top of the page: a title, then what to do about it. */
    loadTitle: "Did not load",
    loadLine: "The connection failed. Check your network settings.",
    reloadTitle: "The refresh failed",
    reloadLine: "The page still shows the previous content.",
  },
};
