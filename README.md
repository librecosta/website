
# LibreCosta Website

LibreCosta 远岸开物官网。正式首页维持基础 HTML，当前空间研究位于独立的 `/lab/expanse`。

## 本地开发

使用 Node.js 24 LTS 与 pnpm 12.8.1：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 http://127.0.0.1:3000/lab/expanse ，切换「首屏远眺 / 接近巨构 / 外围门槛」。这些是固定美术观察点，不是最终镜头时间轴。类型检查、生成约束与生产静态导出：

```sh
pnpm check
pnpm preview
```

静态产物位于 `out/`，不需要业务后端。保留 Next.js App Router、React、TypeScript、Three.js / React Three Fiber、GSAP / ScrollTrigger。实验页只在客户端按需加载一个 WebGL2 Canvas；视图不可用时 HTML 与观察说明仍可阅读。此阶段没有滚动动画。

## 目录与约束

- `src/app/`：基础首页与 `/lab/expanse` 静态页面。
- `src/components/expanse/`：场景参数、确定性地形／布局生成、独立客户端场景和实验页 UI。修改从 `parameters.ts` 开始。
- `docs/research/`：程序化环境调研与浏览器验收记录。
- `docs/creative/`：已确认世界观、叙事骨架、第一幕方向及未冻结事项。
- `.agents/skills/`：五项官方 GSAP Skills，来源、固定版本及许可见该目录 README。
- `AGENTS.md`：Monumental Precision 艺术方向与工程、交互边界。

## 资产提交

World First, Detail Later：先确认世界的几何、尺度、构图与光线，再精修资产。`art/` 中的旧 R1 实验仅保留重建脚本、参数、说明与验证记录，不代表正式选定资产。

P1-A 将 81 个实验二进制（约 122.2 MB）用 `git rm --cached` 移出当前索引，所有本地源文件保留，未改写历史；这不会删除历史 Git 对象或立即缩小已有 `.git`。旧文档中的生成物以本地路径说明，重建步骤保留于各研究目录。

生成工程、模型、纹理、视频及审查截图默认忽略；浏览器截图放 `.local/p1-a/`。网站 `public/` 的 PNG/WebP 等图片格式仍可提交。正式资产需先说明用途、来源和优化后大小，再在 `.gitignore` 写精确路径例外，审查暂存清单后提交，不用 `git add -f` 绕过约束。

Official website: https://librecosta.com . Operated by Chengdu Yuanan Kaiwu Technology Co., Ltd.
