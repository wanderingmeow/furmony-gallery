# Furmony Gallery

一个浏览 [Furmony](https://furmony.com) 领养委托（Adopt）列表的单页网页。由于官方网站翻页浏览很卡，因此这里使用虚拟化的瀑布流。浏览器直接向官方网站的公共 API 发出请求，无需后端、账号、代理。

线上地址：<https://wanderingmeow.github.io/furmony-gallery/>

## 快速开始

```bash
npm install
npm run dev        # http://localhost:5173/furmony-gallery/
npm test           # 14 个文件，132 个测试，不会联网
npm run build      # 构建 dist/，并复制一份 dist/404.html 供 GitHub Pages SPA 模式使用
```

在开发模式下，`src/data/api.ts` 会先尝试使用 `agent/listings_sample.json` 和 `agent/series_sample.json`。
`agent/` 目录没有提交。如果存在这两个文件，将使用其中的数据；反之则直接向线上接口发出请求。打包时，这些分支和数据都不会被放进 `dist/`。

## 功能

- **瀑布流**：只有屏幕中显示的卡片会放进 DOM。可滚动上千行。
- **四个标签页、搜索、排序、筛选**：全部 / 未锁定 / 已锁定 / 收藏。
  搜索匹配名称和描述。数字输入时，匹配编号的前缀（输入 `3` 可找到 #3, #31, #300）。也可搜索匹配主人的社交媒体账号（X、B 站、TikTok、抖音、小红书 ）。右下角按钮打开颜色和物种筛选。
- **三种价格显示方式**：通过右下角按钮切换 一口价 / 12期分期 / 不显示价格，卡片和详情页同时生效。
- **收藏**：点击红心，保存在本地。
- **已锁定的设定**：卡片和类似设定卡片都会在名称行旁显示一把锁。被锁定的设定表示已售罄。
- **详情页**：从底部滑入，可向下拖动关闭。包含：
  - 图片画廊（支持全屏缩放）
  - 信息表格
  - “前往官方网站” 按钮
  - 如设定已被锁定，还会显示主人的社交图标。点击图标打开其个人页面。
- **类似设定**：信息表格下方横向排列若干封面，并按相似度排序。点击一张设定，详情页会平滑滚动至顶部并显示该设定。关闭按钮旁边会同时出现一个返回按钮，允许按原顺序回退。
- **变更通知**：设定被锁定或一次性付清的价格发生变化时，会在右上角显示带徽章的通知。点击通知会打开该设定的详情页。
- **统计页** `/stats`：价格分布、颜色、物种、每月新增设定等图表。模块会在需要时才加载。
- **暗色主题**：跟随系统设置；所有动画都支持 `prefers-reduced-motion`。

## 数据与隐私

- API 有两个：主列表（`entrustAdopt/list`）和“新作登场”频道用的（`productSeries/list`）。后者的条目不会出现在主列表中，因此需要请求两者。
- 列表和图片 URL 保存在 IndexedDB。筛选条件、收藏、价格显示模式、滚动位置保存在 localStorage。
- `public/socials.json`（主人社交账号，手工收集）和 `public/related.json`（相邻表）会在版本发布时一并发布，运行时再加载。如无法读取其中任一文件，将隐藏依赖它的部分。其他功能不受影响。
  - `public/related.json` 包含一张从设定编号到最像的几张设定的编号的映射表，按相似度排序。下载每张封面的缩略图，请求本地 Google EmbeddingGemma 2 服务得到每张封面的向量表示，然后取出最接近的几个编号。
- 不收集任何用户数据。

## 测试

`npm test` 运行 132 个测试：定价规则、筛选、邻居查找、卡片布局、背景滚动锁定、如何合并两个列表等。
使用 happy-dom 作为 DOM， fake-indexeddb 作为存储。测试用 mock 的 API，不会发出请求。

## 技术栈

[SolidJS](https://solidjs.com) + TypeScript · [Vite](https://vite.dev) · [Tailwind CSS](https://tailwindcss.com) v4 · [@solidjs/router](https://github.com/solidjs/router) · [Ant Design icons](https://ant.design) · [@panzoom/panzoom](https://github.com/anvaka/panzoom) · [uPlot](https://github.com/leeoniya/uPlot) + [@dschz/solid-uplot](https://github.com/dschz/solid-uplot) · 测试：[Vitest](https://vitest.dev) + happy-dom + fake-indexeddb

## 许可与版权

[MIT](LICENSE)。所有图片和文字素材属于 Furmony（furmony.com）及其原作者。此网页仅浏览官方网站公开的素材，不作商业用途。
