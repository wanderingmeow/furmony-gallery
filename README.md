# Furmony Gallery

Furmony 委托（Adopt）列表的轻量网页版。官网（furmony.com）加载太卡，所以做了这个更顺滑的单页浏览工具——浏览器直连公开 API，无需后端代理、无账号、纯前端。

## Features

- **瀑布流浏览**：虚拟化行主序网格；右侧 iOS 通讯录式滚动条，拖拽预览首卡片（时间序→ID，价格序→金额）
- **筛选与搜索**：全部 / 未锁定 / 已锁定 / 心愿单四个 Tab，名称 + 描述搜索（防抖），价格 / 时间排序，颜色 / 物种双栏筛选
- **筛选状态编码进 URL**：URL 是筛选唯一事实来源，可分享 / 深链 / 浏览器返回自然生效；滚动位置单独存 localStorage 恢复
- **收藏 Wishlist**：localStorage 持久化
- **详情 bottom-sheet**：画廊 + 全屏缩放 + 信息表 + “前往官网”按钮（无论锁定状态均显示）；移动端全屏 iPhone 式弹层
- **锁定状态变更通知**：右上角通知中心，覆盖所有锁定变化（非仅心愿单），不自动消失，手动关闭
- **数据缓存**：IndexedDB 缓存列表（按 adoptId 键控 + order 保序）+ 内容对比增量合并 + 断网兜底
- **签名图片 URL 稳定缓存**：COS 签名 URL 每次刷新都会变，按 `path → 首次签名 URL` 存 IndexedDB KV 映射（`img_url_map`），跨刷新命中浏览器缓存，不再每刷全量重下

## Data & Privacy

- 直连 `apo.furmony.com` 公开 API（无 CORS 代理）；列表数据与图片 URL 映射存 IndexedDB，心愿单存 localStorage，筛选状态编码在 URL；图片由浏览器缓存
- 不采集任何用户数据

## Copyright & License

[MIT](LICENSE)

所有图片与文字素材均源自 Furmony（furmony.com），版权归原作者所有；本页面仅作浏览展示，不用于商业用途。

## Tech Stack

- [SolidJS](https://solidjs.com) + TypeScript
- [Vite](https://vite.dev)
- [Tailwind CSS](https://tailwindcss.com) v4
- [@solidjs/router](https://github.com/solidjs/router)

## Getting Started

```bash
npm install
npm run dev    # http://localhost:5173
npm run build  # dist/
npm run test   # vitest（cache / filter 层，24 tests，mock API 无网络）
```
