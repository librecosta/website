
# LibreCosta Website

LibreCosta 远岸开物官网。R0 仅提供最小静态工程与创意约束，首页为基础 HTML 页面。

## 本地开发

使用 Node.js 24 LTS 与 pnpm 12.8.1：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 http://127.0.0.1:3000 。类型检查与生产静态导出：

```sh
pnpm check
pnpm preview
```

静态产物位于 `out/`，不需要业务后端。保留 Next.js App Router、React、TypeScript、Three.js / React Three Fiber、GSAP / ScrollTrigger；当前页面不初始化 3D 或动画。

## 目录与约束

- `src/app/`：基础页面、布局和最小样式。
- `docs/creative/`：已确认世界观、叙事骨架、第一幕方向及未冻结事项。
- `.agents/skills/`：五项官方 GSAP Skills，来源、固定版本及许可见该目录 README。
- `AGENTS.md`：Monumental Precision 艺术方向与工程、交互边界。

Official website: https://librecosta.com . Operated by Chengdu Yuanan Kaiwu Technology Co., Ltd.
