// 日本語. The key tree is the one in `zh.ts`.
import type { Dict } from "./shape";

const MONTHS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

export const ja: Dict = {
  common: {
    retry: "再試行",
    ignore: "無視",
    close: "閉じる",
    unknown: "不明",
    loading: "読み込み中…",
    listing: "名前のない子",
    back: "戻る",
    gotIt: "わかりました",
  },

  tab: {
    all: "すべて",
    unlocked: "空き",
    // The pill gives every tab the width of the longest, so these stay short. 空き and 確定 are
    // what a 里募集 post writes; いいね is what this community says for saving one.
    locked: "確定",
    wish: "いいね",
  },

  sort: {
    priceAsc: "価格が安い順",
    priceDesc: "価格が高い順",
    timeAsc: "古い順",
    timeDesc: "新着順",
    relevance: "類似度",
    similarity: "類似度が高い順",
    price: "価格",
    time: "日時",
    title: (mode: string) => `並び順：${mode}`,
  },

  filter: {
    tabGroup: "子の分類",
    title: "絞り込み",
    more: "その他",
    colors: "色",
    races: "種族",
    priceMode: "価格の表示",
    enhance: "検索を強化",
    reset: "リセット",
    restorePrompts: "通知をすべて元に戻す",
    language: "表示言語",
    enhanceNote:
      "意味と画像の検索は Embedding モデルで動きます。検索に使う文字と画像はサーバーに送られ、サーバーはデータを一切保持しません。",
    socialOnly: "オーナーのSNS付きだけ",
    socialNote: (n: number) =>
      `オーナーのSNSが分かるのは ${n} 件だけで、一覧はずいぶん短くなります。`,
    socialMissing:
      "オーナーのSNSの情報を読み込めなかったため、この絞り込みは使えません。",
    onlyUnlocked: "空きだけを表示",
    priceRange: "価格の範囲",
    priceMin: "最低価格",
    priceMax: "最高価格",
    /** How many rows the band holds, under the slider. */
    bandCount: (n: number) => `${n} 件`,
  },

  price: {
    once: "一括払い",
    installment: "12回払い",
    hidden: "非表示",
    noPrice: "価格なし",
  },

  detail: {
    fields: "商品情報",
    photoOf: (n: number, total: number) => `全 ${total} 枚中 ${n} 枚目`,
    owner: "オーナー",
    painter: "絵師",
    painterNumbered: (n: number) => `絵師${n}`,
    race: "種族",
    color: "色",
    status: "状態",
    deposit: "手付金",
    /** `createTime` on the record: the day the listing was posted. 作成日 would be read as the day
     *  the artwork was made. */
    created: "公開日",
    updated: "更新日",
    note: "備考",
    description: "詳しい説明",
    translate: "この紹介を機械翻訳",
    showOriginal: "原文を見る",
    translatedNote: "機械翻訳",
    lockedNow: "仮確定",
    locked: "確定",
    unlocked: "空き",
    adopted: "譲渡済み",
    unadopted: "募集中",
    notFound: "その子は見つかりません",
    goOfficial: "公式サイトへ",
  },

  card: {
    wish: "いいね",
    wished: "いいね済み",
    locked: "確定",
    downPayment: "前金",
    monthly: "月々",
  },

  chrome: {
    toTop: "トップへ",
    stats: "統計",
  },

  search: {
    placeholder: "名前・説明・ID を検索",
    placeholderEnhanced: "お肉が大好きな龍ちゃん",
    examples:
      "お肉が大好きな龍ちゃん | 雪の中の白い狐 | 光る守り夜の竜 | 狼皮をかぶった羊 | ハロウィンの悪戯っ子 | 藻海の被験体 | 夜灯の守り犬",
    clear: "検索をクリア",
    open: "検索",
    close: "検索を閉じる",
  },

  picture: {
    find: "似た画像を探す",
    failed: "検索できませんでした",
    unreadable: "この画像を読み込めません",
    heic: "このブラウザでは HEIC 写真を開けません",
    tooBig: "この画像は大きすぎます",
    noAnswer: "サービスが応答しません",
    offline: "サービスに接続できません",
    timeout: "時間がかかりすぎました",
    change: "別の画像",
    uploading: "アップロード中",
    searching: "検索中",
    dropHint: "画像をドラッグ、貼り付け、またはタップして選択",
    later: "あとでまた試す",
    matchTitle: "画像で探した結果",
    question: "この子は誰？画像を上げれば分かります",
    hint: "イベント写真もデザイン案も歓迎",
  },

  zoom: {
    close: "拡大表示を閉じる",
    in: "拡大",
    out: "縮小",
  },

  related: {
    title: "似た子",
    loading: "似た子を読み込み中",
    onlyUnlockedShort: "空きだけ",
    noneUnlocked: "募集中の似た子はありません",
    open: (id: number, name: string) => `#${id} ${name} を見る`,
  },

  notify: {
    locked: "確定",
    unlocked: "募集再開",
    priceUp: "↑ 値上げ",
    priceDown: "↓ 値下げ",
    dismiss: "後で",
    expand: (n: number) => `通知を ${n} 件表示`,
    title: "変更の通知",
    collapse: "閉じる",
  },

  stats: {
    lockState: "募集状況",
    onceDistribution: "一括払いの価格分布",
    colorDistribution: "色の分布",
    raceDistribution: "種族の分布",
    monthAvg: "月別、新しい子の平均価格",
    monthCount: "月別、新しい子の数",
    axisCount: "件数",
    axisAvg: "平均価格",
    count: (n: number) => `${n} 件`,
    times: (n: number) => `${n} 回`,
    totalTimes: (n: number) => `合計 ${n} 回登場`,
    totalListings: (n: number) => `子は合計 ${n} 件`,
    months: (n: number) => `合計 ${n} か月`,
    avgMedian: (avg: string, median: string) =>
      `平均 ${avg} | 中央値 ${median}`,
    band: (low: string, high: string, count: number) =>
      `${low}-${high}: ${count} 件`,
    monthLabel: (year: number, month: number) =>
      `${year}年${MONTHS[month - 1]}`,
    noData: "データがありません",
  },

  empty: {
    fetchFailedTitle: "子の一覧を読み込めませんでした",
    fetchFailedAction: "何度か試しましたが、取得できませんでした",
    noSocialTitle: "オーナーのSNSの子が見つかりません",
    noWishTitle: "まだいいねがありません",
    pictureFailedTitle: "結果が見つかりません",
    pictureFailedAction: "別の画像を試すか、あとでもう一度",
    pictureNoneTitle: "よく似た画像はありません",
    pictureNoneAction: "別の画像を試してください",
    enhanceFailedTitle: "強化検索は動きませんでした",
    enhanceFailedLine: "キーワード検索でも結果はありません",
    filtersTitle: "この絞り込みでは子がありません",
    queryTitle: (query: string) => `「${query}」に合う子はありません`,
    queryLine: "別の言葉で試してください",
    nothingTitle: "表示できる子がありません",
    nothingAction: "あとでもう一度試すか、公式サイトへ",
    clearSearch: "検索をクリア",
    clearFilters: "絞り込みをクリア",
    closeFilter: "この絞り込みを解除",
  },

  info: {
    /** Two numbers on one page keep two words: 手付金 names `detail.deposit`, and 頭金 carries a
     *  house-and-car loan flavour this shelf never means. */
    downPayment: "前金",
    monthly: "月々",
    periods: (n: number) => `${n} 回`,
    total: (price: string) => `合計 ${price}`,
    original: "元の価格",
    /** Japanese 割 counts the discount, while Chinese 折 counts the price left to pay. */
    discount: (tenths: number) => `${Math.round((10 - tenths) * 10)}%引き`,
  },

  band: {
    copyright:
      "すべての画像と文章の素材は Furmony（furmony.com）由来で、著作権は原作者様に帰属します。このページは閲覧のためだけのもので、商業利用はしません。",
    codeBefore: "コードは",
    license: "MIT ライセンス",
    codeAfter: "で公開されています",
    repository: "リポジトリ",
  },

  money: {
    /** 日本語 puts the word after the number. */
    amount: (n: number) => `${n}元`,
  },

  brand: {
    /** The names these platforms write for themselves in this language. */
    douyin: "Douyin",
    xiaohongshu: "Xiaohongshu",
  },

  storage: {
    /** The notice after the first save, on a browser that deletes stored data without a visit. */
    title: "Safari はいいねしたものを忘れてしまいます",
    fact: "Safari は 7 日間開かなかったサイトについて、覚えておいてくれたものを消してしまいます。",
    installIosLine: "ホーム画面に追加すると、記憶を保てます。",
    installMacLine: "ウェブサイトをアプリにすると、記憶を保てます。",
    keepLine: "追加するには Safari でこのページを開いてください。",
    /** The other way out, the one that asks nothing of the browser. */
    visitLine: "こまめに訪れてあげてくださいね。",
    appleGuide: "Apple の手順を見る。",
  },

  error: {
    /** The dialog a failed load opens: a title, then what to do about it. */
    loadTitle: "一覧の取得に失敗",
    loadLine: "表示内容が不完全な可能性があります。もう一度お試しください。",
  },
};
