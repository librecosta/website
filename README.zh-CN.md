# LibreCosta · 远岸开物官网

[English](README.md)

LibreCosta 官网使用 Next.js 静态导出。第一幕 **The Expanse · 荒原** 沿苍白浅谷走向远方的城市和分段巨环。根路径目前是基础首页，另有独立的立方体材质研究页。

## 本地运行

使用 Node.js 24 LTS 和 [package.json](package.json) 指定的 pnpm 版本。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

- [The Expanse](http://127.0.0.1:3000/lab/expanse) 是主要交互预览。向下滚动探索，向上滚动可原路返回。
- [荒原调试页](http://127.0.0.1:3000/lab/expanse?debug=1) 提供机位和进度、减少动态效果、天空与风沙分层、观测锚点、物体变换和声音音量检查。
- [立方体材质实验](http://127.0.0.1:3000/lab/cube-surface) 用于独立查看材质研究。

声音由用户主动开启。原创环境音乐随站点提供，风声可按需在本地生成。 [声音研究](docs/research/audio.md)

## 验证与预览

```sh
pnpm check
pnpm preview
```

`pnpm check` 运行场景约束检查、TypeScript 检查和生产构建。静态产物位于 `out/`。预览前可停止开发服务器，也可通过 `PORT` 使用其他端口。

## 项目文档

- [Agent 入口](AGENTS.md)、[架构说明](.agents/architecture.md)和[协作手册](.agents/playbook.md)
- [创意愿景](docs/creative/vision.md)、[叙事骨架](docs/creative/narrative.md)和[第一幕方向](docs/creative/act-01-expanse.md)
- [程序化环境研究](docs/research/procedural-environments.md)和[已退役的荒原实验](docs/archive/expanse-legacy/README.md)

由成都远岸开物科技有限公司运营。 [LibreCosta 官网](https://librecosta.com)
