# Furmony Gallery

Furmony 委托（Adopt）列表的轻量网页版。官网（furmony.com）加载太卡，所以做了这个更顺滑的单页浏览工具——浏览器直连公开 API，无需后端代理、无账号、纯前端。

## 为什么这么顺滑

- **基于 SolidJS**：细粒度响应式，只更新真正变化的部分——滚动大列表、频繁切换筛选也不卡
- **列表虚拟化**：只渲染屏幕内可见的卡片，几百上千条也流畅
- **本地缓存**：列表和图片地址存在本地（IndexedDB），刷新秒开，不反复全量下载

## 功能

- **瀑布流浏览**：卡片瀑布式布局，滚动顺滑；右下角「回到顶部 / 刷新」按钮（带进度环）；iOS 点状态栏也能回顶
- **筛选与搜索**：全部 / 未锁定 / 已锁定 / 收藏 四个 Tab；按名字 / 描述搜索（防抖）；纯数字按编号**前缀**匹配（输「3」只找 #3、#31、#3xx）；**搜索也认主人的账号**——昵称、X / B站 / TikTok / 抖音 / 小红书的 handle 都能搜；价格 / 时间排序；颜色 / 物种双栏筛选。筛选状态自动保存，不写 URL
- **收藏**：心形按钮一键收藏，本地保存；**已锁定的设定也能收藏**；收藏 Tab 计数为总数（不因含已锁定而标红）
- **锁定状态**：已锁定的设定，价格行带「已锁定」红色小徽标，一眼可辨
- **详情页（底部弹层）**：滑入式弹层，可拖拽下滑关闭；画廊、全屏缩放、信息表；「前往官网」按钮；**已锁定设定的主人社交账号**——X / B站 / TikTok / 抖音 / 小红书圆角图标（品牌色），点击直接打开主人主页
- **通知中心**：锁定状态一变，右上角通知你（橙色小部件 + 角标），点开看全部，点击某条直接打开详情
- **统计页（/stats）**：价格分布、颜色、物种、每月新增等五张图，懒加载（用到才加载）；悬停看具体数值
- **深链 / 返回**：分享链接直达详情，浏览器返回即关闭弹层
- **暗色主题**：跟随系统，自动切换；中性暖灰配色

## 数据与隐私

- 直连官网公开 API（无代理）；列表、图片地址、收藏、筛选、滚动位置都存在本地（IndexedDB / localStorage）
- 社交账号数据是人工收集、随版本发布的 `public/socials.json`，运行时加载；加载失败只是搜索/详情暂时不显示，不影响使用
- 不采集任何用户数据

## 版权与许可

[MIT](LICENSE)

所有图片与文字素材均源自 Furmony（furmony.com），版权归原作者所有；本页面仅作浏览展示，不用于商业用途。

## 技术栈

- [SolidJS](https://solidjs.com) + TypeScript
- [Vite](https://vite.dev)
- [Tailwind CSS](https://tailwindcss.com) v4
- [@solidjs/router](https://github.com/solidjs/router)
- [Ant Design Icons](https://ant.design)
- [@panzoom/panzoom](https://github.com/anvaka/panzoom)
- [uPlot](https://github.com/leeoniato/uplot) + [@dschz/solid-uplot](https://github.com/dschz/solid-uplot)
- 测试：[Vitest](https://vitest.dev) + happy-dom + fake-indexeddb（mock API，无网络）

## 快速开始

```bash
npm install
npm run dev     # http://localhost:5173/furmony-gallery/
npm run build   # dist/（自动复制 index.html → 404.html，供 GitHub Pages SPA 回退）
npm run test    # vitest（70 tests）
```
