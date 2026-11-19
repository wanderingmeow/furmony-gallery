// 繁體中文. Mostly the 简体中文 dictionary in traditional characters, with the wording a reader on
// the traditional shelf expects. The key tree is the one in `zh.ts`.
import type { Dict } from './shape'

export const zh_tw: Dict = {
  common: {
    retry: '重試',
    close: '關閉',
    unknown: '未知',
    loading: '載入中…',
    listing: '設定',
    back: '返回',
  },

  tab: {
    all: '全部',
    unlocked: '未鎖定',
    locked: '已鎖定',
    wish: '收藏',
  },

  sort: {
    priceAsc: '價格從低到高',
    priceDesc: '價格從高到低',
    timeAsc: '時間從舊到新',
    timeDesc: '時間從新到舊',
    similarity: '依相似度从高到低',
    price: '價格',
    time: '時間',
    title: (mode: string) => `排序：${mode}`,
  },

  filter: {
    colors: '顏色',
    races: '物種',
    priceMode: '價格顯示',
    enhance: '設定搜尋增強',
    reset: '重設',
    language: '介面語言',
    sort: '排序',
    enhanceNote: '語義與影像搜尋由 Embedding 模型驅動，會把搜尋的文字與圖片傳到伺服器，伺服器零資料保留。',
    socialOnly: '只顯示有主人帳號的',
    socialNote: (n: number) => `查得到主人帳號的只有 ${n} 隻，清單會短很多。`,
    socialMissing: '主人帳號的資料沒有載入成功，這個篩選暫時用不了。',
    onlyUnlocked: '只顯示還沒被鎖定的設定',
    priceRange: '價格區間',
    priceMin: '最低價',
    priceMax: '最高價',
    /** How many rows the band holds, under the slider. */
    bandCount: (n: number) => `${n} 隻`,
  },

  price: {
    once: '一口價',
    installment: '12 期分期',
    hidden: '隱藏',
    noPrice: '無價',
  },

  detail: {
    owner: '主人',
    painter: '畫師',
    painterNumbered: (n: number) => `畫師${n}`,
    race: '種族',
    color: '顏色',
    status: '狀態',
    deposit: '定金',
    created: '上架時間',
    updated: '更新時間',
    note: '備註',
    description: '詳細描述',
    translate: '機器翻譯這段介紹',
    showOriginal: '看原文',
    translatedNote: '機器翻譯',
    lockedNow: '鎖定中',
    locked: '已鎖定',
    unlocked: '未鎖定',
    adopted: '已領養',
    unadopted: '未領養',
    notFound: '找不到該設定',
    goOfficial: '前往官網',
  },

  card: {
    wish: '收藏',
    wished: '已收藏',
    locked: '已鎖定',
  },

  toolbar: {
    refresh: '重新整理',
    toTop: '回到頂端',
    stats: '數據統計',
    social: '主人帳號',
  },

  search: {
    placeholder: '搜尋名稱／描述／ID',
    placeholderEnhanced: '愛吃肉的棒小龍…',
    clear: '清除搜尋',
  },

  picture: {
    find: '找類似的',
    failed: '沒搜成',
    unreadable: '這張圖片讀不出來',
    heic: '這個瀏覽器解不了 HEIC 照片',
    tooBig: '這張圖片太大了',
    noAnswer: '服務沒有回應',
    offline: '沒連上服務',
    timeout: '等太久了',
    change: '換一張',
    uploading: '上傳中',
    searching: '尋找中',
    dropHint: '可以拖入圖片、貼上圖片，或點擊選擇',
    later: '稍後再試',
    matchTitle: '影像比對結果',
    question: '是哪一隻毛毛？上傳就知道',
    hint: '展會隨拍、設計稿都行',
  },

  zoom: {
    close: '關閉大圖',
    in: '放大',
    out: '縮小',
  },

  related: {
    title: '類似設定',
    loading: '類似設定載入中',
    onlyUnlockedShort: '只看未鎖定',
    noneUnlocked: '沒有未鎖定的類似設定',
    open: (id: number, name: string) => `看 #${id} ${name}`,
  },

  notify: {
    locked: '已鎖定',
    unlocked: '已取消鎖定',
    priceUp: '↑ 漲價',
    priceDown: '↓ 降價',
    dismiss: '忽略',
    expand: (n: number) => `展開 ${n} 條通知`,
    title: '變更通知',
    collapse: '收起',
  },

  stats: {
    lockState: '鎖定狀態',
    onceDistribution: '一次性支付價格分布',
    colorDistribution: '顏色分布',
    raceDistribution: '物種分布',
    monthAvg: '每月新增設定均價',
    monthCount: '每月新增設定個數',
    axisCount: '數量',
    axisAvg: '均價',
    mysteryRace: '神秘生物',
    count: (n: number) => `${n} 個`,
    times: (n: number) => `${n} 次`,
    totalTimes: (n: number) => `共 ${n} 次出現`,
    totalListings: (n: number) => `共 ${n} 個設定`,
    months: (n: number) => `共 ${n} 個月`,
    avgMedian: (avg: string, median: string) => `均值 ${avg} | 中位 ${median}`,
    band: (low: string, high: string, count: number) => `${low}-${high}: ${count} 個`,
    /** The axis had room for a two-digit year, and 24年3月 is how the shelf writes it. */
    monthLabel: (year: number, month: number) => `${year % 100}年${month}月`,
    noData: '無資料',
  },

  empty: {
    fetchFailedTitle: '沒有載入設定',
    fetchFailedAction: '試過幾次，還是沒拿到',
    noSocialTitle: '沒有查到主人帳號的設定',
    noWishTitle: '還沒有收藏',
    pictureFailedTitle: '沒找到結果',
    pictureFailedAction: '換一張圖，或稍後重試',
    pictureNoneTitle: '沒有很像的',
    pictureNoneAction: '換一張圖試試',
    enhanceFailedTitle: '增強搜尋失敗',
    enhanceFailedLine: '文字比對也沒有結果',
    filtersTitle: '目前篩選下沒有設定',
    queryTitle: (query: string) => `沒有「${query}」相關設定`,
    queryLine: '換個詞試試',
    nothingTitle: '沒有可顯示的設定',
    nothingAction: '稍後再試，或去官網看看',
    clearSearch: '清除搜尋',
    clearFilters: '清除篩選',
    closeFilter: '關閉該篩選',
  },

  info: {
    /** The money paid first, which is the number a reader decides on. */
    downPayment: '首付',
    monthly: '月付',
    periods: (n: number) => `×${n}期`,
    total: (price: string) => `共 ${price}`,
    /** 8.5 折 means the price is 85 % of the original. */
    discount: (tenths: number) => `${tenths.toFixed(1)}折`,
  },

  band: {
    copyright: '所有圖片與文字素材均源自 Furmony（furmony.com），著作權屬於原作者；本頁面僅供瀏覽展示，不用於商業用途。',
    codeBefore: '程式碼以',
    license: 'MIT 協議',
    codeAfter: '開源',
    repository: '專案倉庫',
  },

  money: {
    /** The shelf's numbers are plain 人民币 integers, with no currency field on the wire, so each
     *  language writes the money its own readers expect. */
    amount: (n: number) => `${n}元`,
  },

  brand: {
    douyin: '抖音',
    xiaohongshu: '小紅書',
  },

  error: {
    /** The banner at the top of the page: a title, then what to do about it. */
    loadTitle: '載入失敗',
    loadLine: '網路連線失敗，請檢查網路設定',
    reloadTitle: '沒能刷新',
    reloadLine: '頁面上還是上一次的內容',

  },
}
