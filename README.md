# Furmony Gallery

Furmony 委托（Adopt）列表的轻量网页版。官网（furmony.com）加载太卡，所以做了这个更顺滑的单页浏览工具——浏览器直连公开 API，无需后端代理、无账号、纯前端。

## Features

- **瀑布流浏览**：虚拟化行主序网格；直接以**文档（html/body）为滚动容器**（iOS 状态栏点按 / PC Home 键均可回到顶部）；右侧原生滚动条；滚动驱动的首卡片预览 chip（时间序→`#ID`，价格序→`¥金额`）；右下角「回到顶部 / 刷新」按钮（平滑动画，外圈时钟环实时展示滚动进度）
- **悬浮工具栏**：覆盖在瀑布流之上（`fixed` 叠层，零布局高度），搜索框、排序按钮、筛选 Tab、颜色 / 物种双栏筛选；瀑布流为其预留顶部内边距，卡片始终从工具栏下方开始
- **筛选与搜索**：全部 / 未锁定 / 已锁定 / 心愿单四个 Tab；名称 + 描述搜索（防抖），纯数字查询额外按 `adoptId` 匹配；价格 / 时间排序；颜色 / 物种双栏筛选。**筛选状态存内存 store + localStorage（`furmony_filter`），不写入 URL**——无历史记录污染
- **收藏 Wishlist**：localStorage 持久化；Ant 心形图标，反应式更新
- **详情 bottom-sheet**：共享 Sheet 弹层 chrome（滑入 / 滑出、触摸拖拽可关闭（阈值或快速下滑判定，未达则回弹）、模糊背景、**打开时锁定背景滚动**），详情与统计页复用；画廊两层交叉淡入 + 加载 spinner；全屏缩放（pinch-zoom 已禁用，`+/−` 缩放，Esc / X 关闭）；信息表；「前往官网」按钮（无论锁定状态均显示）；Esc 关闭弹层
- **锁定状态变更通知**：右上角通知中心（收起时橙色小部件 + 角标计数，点击展开堆叠列表）；覆盖**所有**锁定变化（非仅心愿单）；不自动消失，手动关闭；点击某行打开详情
- **数据统计（/stats）**：懒加载统计页（uplot + solid-uplot 仅打开时加载）；五个图表——价格分布直方、颜色分布、物种分布、每月新增价格走势、每月新增数量；锁定状态筛选（全部 / 已锁定 / 未锁定）；悬停任意图表即在其小节右上角显示该点数值（兼作 tooltip），移开恢复聚合汇总
- **深链 / 返回**：`/detail/:id` 深链 + 浏览器返回关闭弹层；路由 base 为挂载路径（无尾斜杠）
- **暗色主题**：仅跟随系统（`prefers-color-scheme`，无手动按钮）；语义色板 token（canvas/surface/surface-2/border/ink/muted/faint），中性暖灰，无蓝色调
- **数据缓存**：IndexedDB 缓存列表（`listingCache`，内容直接对比判断变更，无哈希）+ 签名图片 URL 映射（IndexedDB KV `img_url_map`：`path → 首次签名 URL`，仅映射带 `?` 的签名 URL）——跨刷新命中浏览器缓存，不再每刷全量重下

## Data & Privacy

- 直连 `apo.furmony.com` 公开 API（无 CORS 代理）；列表与图片 URL 映射存 IndexedDB；心愿单、筛选状态、滚动会话（`firstVisibleId`）存 localStorage；图片由浏览器缓存
- 不采集任何用户数据

## Copyright & License

[MIT](LICENSE)

所有图片与文字素材均源自 Furmony（furmony.com），版权归原作者所有；本页面仅作浏览展示，不用于商业用途。

## Tech Stack

- [SolidJS](https://solidjs.com) + TypeScript
- [Vite](https://vite.dev)（`base: '/furmony-gallery'`）
- [Tailwind CSS](https://tailwindcss.com) v4（`@theme` 语义 token）
- [@solidjs/router](https://github.com/solidjs/router)
- [Ant Design Icons](https://ant.design)
- [@panzoom/panzoom](https://github.com/anvaka/panzoom)
- [uPlot](https://github.com/leeoniato/uplot) + [@dschz/solid-uplot](https://github.com/dschz/solid-uplot)（统计图表）
- 测试：[Vitest](https://vitest.dev) + happy-dom + fake-indexeddb（mock API，无网络）

## Getting Started

```bash
npm install
npm run dev     # http://localhost:5173/furmony-gallery/
npm run build   # dist/（自动复制 index.html → 404.html，供 GitHub Pages SPA 回退）
npm run test    # vitest（image / listingCache / filter / scrollRestore / statistics / scrollLock，51 tests）
```
