// The 简体中文 dictionary. It is the source: every other dictionary is checked against its key
// tree, so a key missing from another locale fails the test. A user sees a word or nothing at
// all, and never a bare key.
//
// a value may be a function: `translator` calls it with the caller's arguments
export const zh = {
  common: {
    retry: "重试",
    close: "关闭",
    unknown: "未知",
    loading: "加载中…",
    /** What a listing is called when it has no name. */
    listing: "设定",
    back: "返回",
  },

  tab: {
    all: "全部",
    unlocked: "未锁定",
    locked: "已锁定",
    wish: "收藏",
  },

  sort: {
    priceAsc: "价格从低到高",
    priceDesc: "价格从高到低",
    timeAsc: "时间从旧到新",
    timeDesc: "时间从新到旧",
    relevance: "相关性",
    similarity: "按相似度从高到低",
    /** The group a button belongs to, shown beside the arrow. */
    price: "价格",
    time: "时间",
    /** The filter button's title, which names the order the list is in. */
    title: (mode: string) => `排序：${mode}`,
  },

  filter: {
    tabGroup: "设定分类",
    title: "筛选",
    more: "更多",
    colors: "颜色",
    races: "物种",
    priceMode: "价格显示",
    enhance: "设定搜索增强",
    reset: "重置",
    language: "界面语言",
    enhanceNote:
      "语义和图像搜索由 Embedding 模型驱动，把检索的文字和图片传到服务器，服务器零数据保留。",
    socialOnly: "只显示有主人账号的",
    socialNote: (n: number) => `查得到主人账号的只有 ${n} 只，列表会短很多。`,
    socialMissing: "主人账号的资料没有加载成功，这个筛选暂时用不了。",
    onlyUnlocked: "只显示还没被锁定的设定",
    priceRange: "价格区间",
    priceMin: "最低价",
    priceMax: "最高价",
    /** How many rows the band holds, under the slider. */
    bandCount: (n: number) => `${n} 只`,
  },

  price: {
    once: "一口价",
    installment: "12期分期",
    hidden: "隐藏",
    noPrice: "无价",
  },

  detail: {
    fields: "商品信息",
    photoOf: (n: number, total: number) => `第 ${n} 张，共 ${total} 张`,
    owner: "主人",
    painter: "画师",
    painterNumbered: (n: number) => `画师${n}`,
    race: "种族",
    color: "颜色",
    status: "状态",
    deposit: "定金",
    /** `createTime` on the record: the day the listing was posted. Furmony shows no date of its
     *  own here, so this wording is ours. 创建时间 leaves open whose time it is. */
    created: "上架时间",
    updated: "更新时间",
    note: "备注",
    description: "详细描述",
    translate: "机器翻译这段介绍",
    showOriginal: "看原文",
    translatedNote: "机器翻译",
    lockedNow: "锁定中",
    locked: "已锁定",
    unlocked: "未锁定",
    adopted: "已领养",
    unadopted: "未领养",
    notFound: "未找到该设定",
    goOfficial: "前往官网",
  },

  card: {
    wish: "收藏",
    wished: "已收藏",
    locked: "已锁定",
    /** The words a card prints in front of the number: the shortest that still read. The detail
     *  page has room and asks for `info.downPayment`. */
    downPayment: "首付",
    monthly: "月供",
  },

  chrome: {
    toTop: "回到顶部",
    stats: "数据统计",
  },

  search: {
    placeholder: "搜索名称/描述/ID",
    /** With the enhancement on, the hint is a question the user can type as it is. */
    placeholderEnhanced: "爱吃肉的棒小龙",
    /* Four of these scroll up the box at a time. The separator keeps a space on each side, so a
       pipe in a translation cannot split a line. Each one has to be something the search answers:
       it compares the sentence against names and descriptions, and never looks up an artist. */
    examples:
      "爱吃肉的棒小龙 | 雪地里的白狐狸 | 会发光的守夜龙 | 披着狼皮的羊 | 万圣节的捣蛋鬼 | 藻海里的实验体 | 提夜灯的守夜犬",
    clear: "清除搜索",
    open: "搜索",
    close: "关闭搜索",
  },

  picture: {
    find: "找类似的",
    failed: "没搜成",
    unreadable: "这张图片读不出来",
    heic: "这个浏览器解不了 HEIC 照片",
    tooBig: "这张图片太大了",
    noAnswer: "服务没有应答",
    offline: "没连上服务",
    timeout: "等得太久了",
    change: "换一张",
    uploading: "上传中",
    searching: "查找中",
    dropHint: "可以拖入图片，粘贴图片，或者点击选择",
    later: "稍后再试",
    matchTitle: "视觉匹配结果",
    question: "是哪一只毛毛？上传就知道",
    hint: "展会随拍、设计稿都行",
  },

  zoom: {
    close: "关闭大图",
    in: "放大",
    out: "缩小",
  },

  related: {
    title: "类似设定",
    loading: "类似设定载入中",
    onlyUnlockedShort: "只看未锁定",
    noneUnlocked: "没有未锁定的类似设定",
    open: (id: number, name: string) => `看 #${id} ${name}`,
  },

  notify: {
    locked: "已锁定",
    unlocked: "已取消锁定",
    priceUp: "↑ 涨价",
    priceDown: "↓ 降价",
    dismiss: "忽略",
    expand: (n: number) => `展开 ${n} 条通知`,
    title: "变更通知",
    collapse: "收起",
  },

  stats: {
    lockState: "锁定状态",
    onceDistribution: "一次性支付价格分布",
    colorDistribution: "颜色分布",
    raceDistribution: "物种分布",
    monthAvg: "每月新增设定均价",
    monthCount: "每月新增设定个数",
    axisCount: "数量",
    axisAvg: "均价",
    count: (n: number) => `${n} 个`,
    times: (n: number) => `${n} 次`,
    totalTimes: (n: number) => `共 ${n} 次出现`,
    totalListings: (n: number) => `共 ${n} 个设定`,
    months: (n: number) => `共 ${n} 个月`,
    avgMedian: (avg: string, median: string) => `均值 ${avg} | 中位 ${median}`,
    band: (low: string, high: string, count: number) =>
      `${low}-${high}: ${count} 个`,
    /** 简体中文 writes a month as the last two year digits and the month number. */
    /** The axis fits a short label, so the year keeps two digits: 24年3月 is how Furmony writes it. */
    monthLabel: (year: number, month: number) => `${year % 100}年${month}月`,
    noData: "无数据",
  },

  empty: {
    fetchFailedTitle: "没能载入设定",
    fetchFailedAction: "试过几次，还是没拿到",
    noSocialTitle: "没有查到主人账号的设定",
    noWishTitle: "还没有收藏",
    pictureFailedTitle: "没找到结果",
    pictureFailedAction: "换一张图，或者稍后重试",
    pictureNoneTitle: "没有很像的",
    pictureNoneAction: "换一张图试试",
    enhanceFailedTitle: "增强搜索失败",
    enhanceFailedLine: "文字匹配也没有结果",
    filtersTitle: "当前筛选下没有设定",
    queryTitle: (query: string) => `没有「${query}」相关设定`,
    queryLine: "换个词试试",
    nothingTitle: "没有可显示的设定",
    nothingAction: "稍后再试，或者去官网看看",
    clearSearch: "清除搜索",
    clearFilters: "清除筛选",
    closeFilter: "关闭该筛选",
  },

  info: {
    /** The money paid first, which is the number a user decides on. */
    downPayment: "首付",
    monthly: "月供",
    periods: (n: number) => `×${n}期`,
    total: (price: string) => `共 ${price}`,
    /** The price a listing came down from. It reads as part of the discount, not a second price. */
    original: "原价",
    /** 8.5 折 means the price is 85 % of the original. */
    discount: (tenths: number) => `${tenths.toFixed(1)}折`,
  },

  band: {
    copyright:
      "所有图片与文字素材均源自 Furmony（furmony.com），版权归原作者所有；本页面仅作浏览展示，不用于商业用途。",
    codeBefore: "代码以",
    license: "MIT 协议",
    codeAfter: "开源",
    repository: "项目仓库",
  },

  money: {
    /** The wire carries plain 人民币 integers with no currency field, so each dictionary writes the
     *  money its own users expect. */
    amount: (n: number) => `¥${n}`,
  },

  brand: {
    /** The names these platforms write for themselves in this language. */
    douyin: "抖音",
    xiaohongshu: "小红书",
  },

  error: {
    /** The banner at the top of the page: a title, then what to do about it. */
    loadTitle: "载入失败",
    loadLine: "网络连接失败，请检查网络设置",
    reloadTitle: "没能刷新",
    reloadLine: "页面上还是上一次的内容",
  },
};
