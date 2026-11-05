# LibreCosta Website

## 当前范围与工程

- R0 只建立最小工程与创意基础。未经后续任务授权，不开发 3D 场景、新首屏或动画原型。
- 使用 Next.js App Router、React、TypeScript、Three.js、React Three Fiber、GSAP / ScrollTrigger 与 pnpm；禁止 Astro。依赖采用兼容的稳定版本并保留 lockfile。
- 优先静态导出；不接入后台、数据库、CMS、认证或其他业务系统。不预建 Scene Manager、渲染管线、插件架构或空目录。
- `src/app/` 保存真实 HTML 页面。未来的 3D 场景作为独立客户端模块按需加载，HTML 阅读不能依赖 Canvas 初始化成功。
- 未来逐帧更新使用 refs / useFrame；动画进度与渲染职责明确，避免多个系统争抢同一相机属性。清理监听器、动画与 GPU 资源，尊重减少动态效果偏好。
- 使用 `pnpm check` 验证类型与静态生产构建。视觉品质必须通过真实浏览器画面验收，代码复杂度和构建成功不能替代艺术验收。
- 保留用户修改和正常 Git 历史；未经授权不发布，不合并到 pre-master / master。不修改其他项目或不必要的全局配置。

## 艺术方向

**Monumental Precision — 巨构精密主义**：以具有结构性共鸣的精密巨构进行视觉叙事。

- 巨构体现超现实尺度、空间秩序、严密几何与建筑崇高感，可以属于不同文明、不同时空。
- 允许蛮荒、侵蚀、锈蚀、废弃、现代、科幻和崭新等不同材质与时代风格。
- 美术统一性由空间比例、建筑排列、材质、光线和镜头语言建立，不用单一时代或材质限制世界。
- 文字极简，不将首页做成 SaaS 产品展示页。UI 为 **Silent Instrument**：轻量、精密、克制，具有微弱仪式感。
- 禁止传统游戏 HUD、廉价科幻装饰、常见粒子球和模板化营销页面。

## 世界观与交互

- 用户是非人类视角的“遗落的观测核”（**The Witness Core**）。主题是见证与回归，不是冒险游戏或产品介绍。
- 场景旅程由滚动进度控制，不能由首次滚轮触发不可打断的自动动画。用户能够停止、继续与反向探索。
- 允许适度惯性、滚转、倾斜与复杂相机路径；运动必须重视空间逻辑、镜头稳定性和舒适度。
- 已确认世界观见 `docs/creative/vision.md`；叙事骨架见 `narrative.md`；第一幕方向与未冻结事项见 `act-01-expanse.md`。不擅自补全未冻结设定。
- 项目级 GSAP Skills 位于 `.agents/skills/`，来源与许可见其中的 `README.md`。本轮安装 Skills 不代表授权制作动画。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
