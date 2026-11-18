# WORKS V0.1 最终验收

**冻结结论**　WORKS V0.1 满足冻结条件。八座原创岛屿、项目档案和 Orbit Reel 通过静态生产构建回归。八座正式 GLB、八张轮盘预览和 Blender 资产与 W5 开始前字节一致。

## 正式资产

下表按轮盘顺序排列。三角面数取 GLB 索引，Draw Calls 取 Chrome 中单次交互重绘，分别列出屏上和离屏绘制。八张轮盘及回退预览均为 560 × 420 透明 WebP，逐张对照了默认视角和模型轮廓。

| 作品与状态 | GLB | 轮盘预览 | Blender 源文件 | 字节 | 三角面 | 屏上 / 离屏 |
| --- | --- | --- | --- | ---: | ---: | ---: |
| 01 GoFurry · 开发中 | [模型](../../public/works/islands/gofurry.glb) | [预览](../../public/works/previews/gofurry.webp) | [源文件](../../assets/works/gofurry/gofurry.blend) | 1,826,616 | 81,340 | 3 / 0 |
| 02 Tool4Furry · 开发中 | [模型](../../public/works/islands/tool4furry.glb) | [预览](../../public/works/previews/tool4furry.webp) | [源文件](../../assets/works/tool4furry/tool4furry.blend) | 1,831,560 | 91,354 | 4 / 0 |
| 03 LibreCosta Uptime · 已发布 | [模型](../../public/works/islands/uptime.glb) | [预览](../../public/works/previews/librecosta-uptime.webp) | [源文件](../../assets/works/uptime/uptime.blend) | 1,459,392 | 69,086 | 4 / 0 |
| 04 Harvest · 开源项目 | [模型](../../public/works/islands/harvest.glb) | [预览](../../public/works/previews/harvest.webp) | [源文件](../../assets/works/harvest/harvest.blend) | 891,716 | 40,610 | 3 / 0 |
| 05 Liquid Glass · 已发布 | [模型](../../public/works/islands/liquid-glass.glb) | [预览](../../public/works/previews/liquid-glass.webp) | [源文件](../../assets/works/liquid-glass/liquid-glass.blend) | 1,081,908 | 52,462 | 8 / 1 |
| 06 Wavefield · 开源项目 | [模型](../../public/works/islands/wavefield.glb) | [预览](../../public/works/previews/wavefield.webp) | [源文件](../../assets/works/wavefield/wavefield-final.blend) | 933,268 | 113,576 | 7 / 0 |
| 07 SoFarAway · 开发中 | [模型](../../public/works/islands/sofaraway.glb) | [预览](../../public/works/previews/sofaraway.webp) | [源文件](../../assets/works/sofaraway/sofaraway.blend) | 1,111,248 | 58,340 | 9 / 4 |
| 08 GopherAtlas · 持续更新 | [模型](../../public/works/islands/gopher-atlas.glb) | [预览](../../public/works/previews/gopheratlas.webp) | [源文件](../../assets/works/gopher-atlas/gopher-atlas.blend) | 1,873,704 | 93,110 | 3 / 0 |

Wavefield 的双面薄纱增加一次屏上绘制，实际提交 125,864 个三角面。Uptime、Liquid Glass、SoFarAway 的首帧另有 42 次离屏环境反射绘制。后两者在交互重绘时保留表中所列的透射绘制。

## 资产和许可

- 移除 `bay.glb`、`foundry.glb`、`signal.glb`、13 份无人使用的旧项目图和图标，以及旧 WORKS 字标。静态导出中三个旧模型返回 404，当前目录与产物中均只有八份正式 GLB。公共目录文件净移除 1,669,757 字节，不计新增许可文本。三份 Blender 历史对照脚本从对应 Git 提交读取旧模型，已用 Blender 重新渲染通过。 [Harvest 对照](../../assets/works/harvest/render_references.py) · [Liquid Glass 对照](../../assets/works/liquid-glass/compare.py) · [SoFarAway 对照](../../assets/works/sofaraway/compare.py)
- W5 发布时，八岛和轮盘预览作为 LibreCosta 原创资产按 BSD 3-Clause 分发。当前分发范围见[资产授权声明](../../ASSETS-LICENSE.md)。Wenz MIT 保留用于单岛相机和模型定位的改编代码，已移除退役模型说明。TuneShape MIT 对应现用 Orbit Reel。Draco 的两个分发文件与 Three.js r187 安装包逐字节一致，保留 Apache 2.0。补录 Three.js 与 Motion 系列的 MIT 文本。 [素材声明](../../public/works/asset-notices.txt) · [Wenz](../../public/works/wenz-license.txt) · [TuneShape](../../public/License/tuneshape-orbit-reel.txt) · [Draco](../../public/works/draco-license.txt) · [运行库](../../public/works/runtime-licenses.txt)

## 浏览器回归

- `pnpm check` 通过。使用 `pnpm preview` 服务的 `out/` 产物，在 Windows、Chrome 157、AMD Radeon 上完成 40 组岛屿与视口组合。覆盖 1920 × 1080、1440 × 900、960 × 720、390 × 844 和 320 × 568。移动视口、触屏及捏合使用 Chrome 模拟。
- 18 张档案卡包含 8 张作品和 10 张预留。通过 Ring / Arc、鼠标和触屏拖动与惯性、自动旋转、暂停与恢复、键盘选中、焦点和 Escape、reduced motion、返回位置及形态、连续切换和入场打断检查。预留卡不进入详情。
- 八岛分别检查正面、背面、近景、缩放与复位。复位后的场景截图区域与默认视角逐像素一致。核对档案名称、状态、说明、配图、替代文本及外部链接。逐岛阻断模型请求和禁用 WebGL 均有静态回退。
- 1440 × 900 本地冷载记录到 26 个子资源请求，八张轮盘图合计 350,668 字节。单岛渲染器 chunk、GLB、Draco 请求及 WebGL 初始化均为零。自动旋转的 120 个 `requestAnimationFrame` 间隔中位数为 8.3 ms，P95 为 20.7 ms。该次观察没有长任务。
- 每次详情仅请求选中 GLB，静止后不再绘制。逐岛退出及五次混合循环均释放缓冲、纹理和旧上下文。慢速下载中退出、再次打开和快速翻阅均可恢复。浏览器截图和测量记录保存在 `.local/works-w5/`。

共享站点根路径 `/favicon.ico` 在静态预览中返回 404。它不影响 WORKS 资产和交互，无阻塞冻结的问题。
