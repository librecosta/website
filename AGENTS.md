# LibreCosta Website

## 当前范围与工程

- 当前 P1-A3 在 `/lab/expanse` 研究浅谷推进：前景谷地、低矮半埋残片、中景斜插柱阵、远方主体分层显露。正常界面只保留品牌、轻提示和底部细进度线；隐藏滚动条外观，保留原生滚动，调试信息限 `?debug=1`。正式首页保持基础 HTML，后续世界与资产精修需独立授权。
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

## 世界优先与资产

**World First, Detail Later — 先建立世界，再雕刻世界。**

- Monumental Precision 首先来自几何结构、空间尺度、建筑秩序、构图与光线。整体构图未确认前，不大量制作精细纹理、雕刻或高模。
- 程序化优先用于地形、重复建筑与几何结构、布局辅助、天空、大气和动态视觉效果。人工配置主要空间关系，固定种子辅助生成，禁止随机方块散布冒充世界。
- Blender 用于独特几何、难以简单程序化的结构、重要美术资产与必要离线烘焙。所有视觉设计以真实浏览器效果为主要验收依据。
- `art/` 与 `docs/creative/witness-core/` 的 R1 实验是研究历史，不代表选定正式资产。保留可重建脚本、参数、设计说明与必要验证报告；生成的工程、模型、纹理、视频和截图默认留在本地，由 `.gitignore` 控制。
- 只有正式定稿且运行或协作确需跟踪的资产才可提交：先记录用途、来源、体积与优化结果，再添加精确路径的忽略例外。网站 `public/` 必需的图片格式不全局禁用。禁止未审查地 `git add -A` 或用 `git add -f` 绕过约束。
- 删除历史实验跟踪时使用 `git rm --cached` 保留本地源文件；不改写 Git 历史。提交前检查暂存文件清单、二进制大小与文档链接。
- 程序化环境调研见 `docs/research/procedural-environments.md`，当前唯一场景参数入口为 `src/components/expanse/parameters.ts`。

## 世界观与交互

- 用户是非人类视角的“遗落的观测核”（**The Witness Core**）。主题是见证与回归，不是冒险游戏或产品介绍。
- 场景旅程由滚动进度控制，不能由首次滚轮触发不可打断的自动动画。用户能够停止、继续与反向探索。
- 允许适度惯性、滚转、倾斜与复杂相机路径；运动必须重视空间逻辑、镜头稳定性和舒适度。
- 已确认世界观见 `docs/creative/vision.md`；叙事骨架见 `narrative.md`；第一幕方向与未冻结事项见 `act-01-expanse.md`。不擅自补全未冻结设定。
- 项目级 GSAP Skills 位于 `.agents/skills/`，来源与许可见其中的 `README.md`。GSAP 只驱动进度，渲染循环统一写入相机；旅行可停止、可逆，减少动态效果时采用静态体验。修改布局／路径后运行几何与净空检查。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
