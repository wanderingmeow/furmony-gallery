// 日本語. The key tree is the one in `zh.ts`.
import type { Dict } from './shape'

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

export const ja: Dict = {
  common: {
    retry: '再試行',
    close: '閉じる',
    unknown: '不明',
    loading: '読み込み中…',
    listing: '設定',
    back: '戻る',
  },

  tab: {
    all: 'すべて',
    unlocked: '空き',
    locked: 'ロック済み',
    wish: 'お気に入り',
  },

  sort: {
    priceAsc: '価格が安い順',
    priceDesc: '価格が高い順',
    timeAsc: '古い順',
    timeDesc: '新着順',
    similarity: '類似度が高い順',
    price: '価格',
    time: '日時',
    title: (mode: string) => `並び順：${mode}`,
  },

  filter: {
    colors: '色',
    races: '種族',
    priceMode: '価格の表示',
    enhance: '検索を強化',
    reset: 'リセット',
    language: '表示言語',
    sort: '並び順',
    enhanceNote: '意味と画像の検索は Embedding モデルで動きます。検索に使う文字と画像はサーバーに送られ、サーバーはデータを一切保持しません。',
    socialOnly: '飼い主アカウント付きだけ',
    socialNote: (n: number) => `飼い主アカウントが分かるのは ${n} 件だけで、一覧はずいぶん短くなります。`,
    socialMissing: '飼い主アカウントの情報を読み込めなかったため、この絞り込みは使えません。',
    onlyUnlocked: 'ロックなしだけ',
    priceRange: '価格の範囲',
    priceMin: '最低価格',
    priceMax: '最高価格',
    /** How many rows the band holds, under the slider. */
    bandCount: (n: number) => `${n} 件`,
  },

  price: {
    once: '一括払い',
    installment: '12回分割',
    hidden: '非表示',
    noPrice: '価格なし',
  },

  detail: {
    owner: '飼い主',
    painter: '作家',
    painterNumbered: (n: number) => `作家${n}`,
    race: '種族',
    color: '色',
    status: '状態',
    deposit: '手付金',
    /** `createTime` on the record: the day the listing was posted. 作成日 would be read as the day
     *  the artwork was made. */
    created: '公開日',
    updated: '更新日',
    note: '備考',
    description: '詳細説明',
    translate: 'この紹介を機械翻訳',
    showOriginal: '原文を見る',
    translatedNote: '機械翻訳',
    lockedNow: 'ロック中',
    locked: 'ロック済み',
    unlocked: '空き',
    adopted: '譲渡済み',
    unadopted: '未譲渡',
    notFound: 'その設定は見つかりません',
    goOfficial: '公式サイトへ',
  },

  card: {
    wish: 'お気に入り',
    wished: '保存済み',
    locked: 'ロック済み',
    downPayment: '頭金',
    monthly: '月々',
  },

  toolbar: {
    refresh: '更新',
    toTop: 'トップへ',
    stats: '統計',
    social: '飼い主アカウント',
  },

  search: {
    placeholder: '名前・説明・ID を検索',
    placeholderEnhanced: 'お肉が大好きな龍ちゃん…',
    clear: '検索をクリア',
  },

  picture: {
    find: '似たものを探す',
    failed: '検索できませんでした',
    unreadable: 'この画像を読み込めません',
    heic: 'このブラウザでは HEIC 写真を開けません',
    tooBig: 'この画像は大きすぎます',
    noAnswer: 'サービスが応答しません',
    offline: 'サービスに接続できません',
    timeout: '時間がかかりすぎました',
    change: '別の画像',
    uploading: 'アップロード中',
    searching: '検索中',
    dropHint: '画像をドラッグ、貼り付け、またはタップして選択',
    later: 'あとでまた試す',
    matchTitle: '画像で探した結果',
    question: 'どれちゃんかな？アップロードすれば分かる',
    hint: 'イベントの写真も設計案もどうぞ',
  },

  zoom: {
    close: '拡大表示を閉じる',
    in: '拡大',
    out: '縮小',
  },

  related: {
    title: '似た設定',
    loading: '似た設定を読み込み中',
    onlyUnlockedShort: '空きだけ',
    noneUnlocked: '空きでよく似た設定はありません',
    open: (id: number, name: string) => `#${id} ${name} を見る`,
  },

  notify: {
    locked: 'ロック済み',
    unlocked: 'ロックを解除',
    priceUp: '↑ 値上げ',
    priceDown: '↓ 値下げ',
    dismiss: '無視',
    expand: (n: number) => `通知を ${n} 件表示`,
    title: '変更の通知',
    collapse: '閉じる',
  },

  stats: {
    lockState: 'ロック状態',
    onceDistribution: '一括払いの価格分布',
    colorDistribution: '色の分布',
    raceDistribution: '種族の分布',
    monthAvg: '月別の新規設定の平均価格',
    monthCount: '月別の新規設定の数',
    axisCount: '件数',
    axisAvg: '平均価格',
    count: (n: number) => `${n} 件`,
    times: (n: number) => `${n} 回`,
    totalTimes: (n: number) => `合計 ${n} 回登場`,
    totalListings: (n: number) => `合計 ${n} 件の設定`,
    months: (n: number) => `合計 ${n} か月`,
    avgMedian: (avg: string, median: string) => `平均 ${avg} | 中央値 ${median}`,
    band: (low: string, high: string, count: number) => `${low}-${high}: ${count} 件`,
    monthLabel: (year: number, month: number) => `${year}年${MONTHS[month - 1]}`,
    noData: '資料がありません',
  },

  empty: {
    fetchFailedTitle: '設定を読み込めませんでした',
    fetchFailedAction: '何度か試しましたが、取得できませんでした',
    noSocialTitle: '飼い主アカウントの設定が見つかりません',
    noWishTitle: 'まだお気に入りがありません',
    pictureFailedTitle: '結果が見つかりません',
    pictureFailedAction: '別の画像を試すか、あとでもう一度',
    pictureNoneTitle: 'よく似たものはありません',
    pictureNoneAction: '別の画像を試してください',
    enhanceFailedTitle: '強化検索が失敗しました',
    enhanceFailedLine: '文字の一致でも結果はありません',
    filtersTitle: 'この絞り込みでは設定がありません',
    queryTitle: (query: string) => `「${query}」に一致する設定はありません`,
    queryLine: '別の言葉で試してください',
    nothingTitle: '表示できる設定がありません',
    nothingAction: 'あとでもう一度試すか、公式サイトへ',
    clearSearch: '検索をクリア',
    clearFilters: '絞り込みをクリア',
    closeFilter: 'この絞り込みを解除',
  },

  info: {
    /** The money paid first, which is the number a reader decides on. */
    downPayment: '頭金',
    monthly: '月々',
    periods: (n: number) => `${n} 回`,
    total: (price: string) => `合計 ${price}`,
    /** Japanese 割 counts the discount, while Chinese 折 counts the price left to pay. */
    discount: (tenths: number) => `${Math.round((10 - tenths) * 10)}%引き`,
  },

  band: {
    copyright: 'すべての画像と文章の素材は Furmony（furmony.com）由来で、著作権は原作者にあります。このページは閲覧のためだけのもので、商業利用はしません。',
    codeBefore: 'コードは',
    license: 'MIT ライセンス',
    codeAfter: 'で公開されています',
    repository: 'リポジトリ',
  },

  money: {
    /** 日本語 puts the word after the number. */
    amount: (n: number) => `${n}元`,
  },

  brand: {
    /** The names these platforms write for themselves in this language. */
    douyin: 'Douyin',
    xiaohongshu: 'Xiaohongshu',
  },

  error: {
    /** The banner at the top of the page: a title, then what to do about it. */
    loadTitle: '読み込めませんでした',
    loadLine: '通信に失敗しました。ネットワーク設定を確認してください。',
    reloadTitle: '更新できませんでした',
    reloadLine: '前回の内容を表示しています',

  },
}
