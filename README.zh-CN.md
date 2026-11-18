# LibreCosta · 远岸开物官网

[English](README.md)

**原创代码与 3D 模型采用 [BSD-3-Clause](LICENSE)** · [开源许可声明](LICENSE-STATEMENT.md) · [资产授权说明](ASSETS-LICENSE.md)

LibreCosta 官网使用 Next.js 静态导出。国际站首页呈现第一幕 **The Expanse · 荒原**，沿苍白浅谷走向远方的城市和分段巨环。

## 本地运行

使用 Node.js 24 LTS 和 [package.json](package.json) 指定的 pnpm 版本。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

- 本地默认运行 CN 版，ABOUT 为首页。[The Expanse](http://127.0.0.1:3000/world/) 位于 WORLD 页。向下滚动探索，向上滚动可原路返回。
- 使用 `pnpm dev` 时，[荒原调试视图](http://127.0.0.1:3000/world/?debug=1) 提供机位和进度、减少动态效果、天空与风沙分层、观测锚点、物体变换和声音音量检查。

声音由用户主动开启。原创环境音乐和程序化风声随站点提供，生成与验证方法见 [声音研究](docs/research/audio.md)。

## 验证与预览

```sh
pnpm check
pnpm preview
```

`pnpm check` 运行场景约束检查、TypeScript 检查和生产构建。静态产物位于 `out/`。预览前可停止开发服务器，也可通过 `PORT` 使用其他端口。

## 地区静态构建

| 地区 | 构建命令 | 输出 | 计划托管平台 |
| --- | --- | --- | --- |
| CN | `pnpm build:cn` | `dist/cn/` | EdgeOne Makers |
| INTL | `pnpm build:intl` | `dist/intl/` | Cloudflare |

使用 `pnpm preview cn` 或 `pnpm preview intl` 预览对应静态产物。构建后、发布前运行 `pnpm check:release cn` 或 `pnpm check:release intl`。CN 包含中文与英语。INTL 包含中文、英语、日语、德语、法语和西班牙语。详见[地区与路由契约](docs/publication-routing.md)及[部署设置和发布前置条件](docs/publication-deployment.md)。

## 项目文档

- [Agent 入口](AGENTS.md)、[架构说明](.agents/architecture.md)和[协作手册](.agents/playbook.md)
- [创意愿景](docs/creative/vision.md)、[叙事骨架](docs/creative/narrative.md)和[第一幕方向](docs/creative/act-01-expanse.md)
- [程序化环境研究](docs/research/procedural-environments.md)和[已退役的荒原实验](docs/archive/expanse-legacy/README.md)

## 许可证

官网原创代码与原创 3D 模型采用 [BSD-3-Clause](LICENSE)。其余原创美术、音频与品牌资产保留版权。第三方材料沿用上游条款。适用范围与例外见[资产授权声明](ASSETS-LICENSE.md)。

由成都远岸开物科技有限公司运营。 [LibreCosta 官网](https://librecosta.com)
