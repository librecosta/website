# WORKS · WEB-V0.1-A4

本文记录 A4 的八岛总览和当时的资产来源。现行资源见 [WORKS 资产清单](../../public/works/asset-notices.txt)，回波岬的原创岛屿见 [Wavefield WF2](../../assets/works/wavefield/art-review.md)。

`/works` 是一个全视口连续海域。八个作品各占一座岛，默认正交机位同时覆盖八岛。拖动海面、方向键或鼠标滚轮可在边界内探索。岛体和浮标都可选择，档案打开时相机为纸面腾出空间，关闭后返回原来的探索位置。项目数据同时供浮标、档案、索引与静态 HTML 列表使用。生产构建延续 Next.js 静态导出。

## 上游移植

指定提交在本地通过 Vite 运行，并与公开版实景对照。`works-scene.ts` 移植了 `cameraFraming` 的机位与岛屿构图、`islandModel` 的模型处理、`interactionManager` 的射线选择与高亮缓动。`water.ts` 和 `shore-field.ts` 移植海面着色器及岸线高度切片、填充和距离场，八座岛均由各自的真实几何生成浪带。档案和定位流程采用 `IslandPanel`、`Panels` 和 `world-map` 的交互结构，使用 LibreCosta 自己的版式。相机俯角约 23°，沿用原版的等距方位。海域采用固定日间光色。[上游指定提交](https://github.com/wenzrejas/wenzrejas.github.io/tree/0319381ab0310cdabaca734d4e9c92bfcee79a49) · [原版在线](https://wenzrejas.github.io/)

| 作品 | GLB 来源和改造 | 文件体积 |
| --- | --- | ---: |
| GoFurry | Cozy Isle `Cozy_Isle`，保留聚落与码头，移除船和咖啡店霓虹 | 405 KB |
| Tool4Furry | Buildshore 的 BeeSigned 工坊地形批次与蜂窝光窗 | 498 KB |
| LibreCosta Uptime | Lumina Point `MainIsland`，保留灯塔和步道，移除联系方式设施 | 652 KB |
| Liquid Glass | Tech Grove `Island_Creative`，移除原雕塑和字样，加入玻璃地标 | 483 KB |
| Wavefield | Buildshore 的 Qoves 峭壁地形批次，分离原品牌标志 | 675 KB |

上述 Blender 岛体和随文件提供的烘焙光影贴图来自 Wenz Louie Rejas，按该仓库 MIT 许可证使用。取出模型子树时保留世界变换，移除未引用的节点和材质，再以 Draco 压缩网格、以最大边 1024 px 的 WebP 保存烘焙纹理。五个 GLB 合计 2.71 MB，Draco WASM 和 JS 包装合计 0.25 MB，均仅在 WORKS 场景挂载时下载。Harvest 层畴屿、Sofaraway 远拍岛和 GopherAtlas 页港使用 LibreCosta 原创几何，各自有独立岸线与地标。Draco 解码器沿用安装的 Three.js r187 所带版本，适用 Apache 2.0。[资产清单](../../public/works/asset-notices.txt) · [Wenz MIT](../../public/works/wenz-license.txt) · [Draco Apache 2.0](../../public/works/draco-license.txt)

八份档案沿用真实项目预览。已核实页面显示的 GitHub 与 GopherAtlas 入口，包括博客主页、文章列表和 Wavefield 技术文章。GoFurry、Tool4Furry、Sofaraway 的独立站点域名在本次环境中未能解析，档案使用可打开的 GitHub 入口。

## 浏览器验收

浏览器证据保存在 `.local/works-a4/`。`upstream-island-1440.png` 是原版在线的 Lumina Point，`upstream-lumina-1440.png` 是其世界地图与定位面板。新页面的总览见 `works-overview-1440.png`、`works-overview-1920.png`、`works-overview-390.png` 和 `works-overview-320.png`。`works-hover-1440.png` 记录从岛体触发的介绍，`works-menu-1440.png` 和 `works-menu-390.png` 记录 Sofaraway 档案。用于同地形对照的近距截图见 `works-approach-1440.png`。

五座移植岛保留原模型的垂直层次与烘焙细节，八座岛统一使用岸线泡沫。三座原创岛共享同一套光照，但近景的植物、岩面、阴影和建筑细节仍比 Wenz 原模型疏，视觉完成度尚未达到同等水准。

Chrome 157 对静态生产产物测试了 1440×900、1920×1080、390×844、320×568。各视口均能在总览选中八座岛，并经索引打开各份档案。检查了 44 CSS px 移动点击区、触摸拖动、档案边界与图片、鼠标直接点选岛体、键盘聚焦与 Enter、Escape 焦点恢复、减少动态效果、失焦及隐藏暂停。验证 WebGL 禁用、丢失及恢复，禁用 JavaScript 时八项链接仍可从静态 HTML 打开。浏览器记录中的未捕获异常和控制台错误均为零，WORKS 未请求第一幕资源，首页未请求岛屿模型。触屏测试使用 Chrome 模拟。

| 指标 | 1440×900 | 1920×1080 | 390×844 | 320×568 |
| --- | ---: | ---: | ---: | ---: |
| 实测 DPR | 1 | 1 | 1.25 | 1.25 |
| 海面着色目标 | 640×400 | 640×360 | 244×528 | 200×355 |
| Draw Calls | 50 | 50 | 50 | 50 |
| Triangles | 160,414 | 160,414 | 160,414 | 160,414 |
| Three.js 几何体 / 纹理 | 50 / 15 | 50 / 15 | 50 / 15 | 50 / 15 |

`/works?worksDebug` 将计数写入 Canvas 的 `data-scene-stats`。海面颜色在较小的渲染目标计算，岛屿与岸线照常按 Canvas 分辨率绘制。1440×900、DPR 1、SwiftShader 软件渲染下采集 79 个总览与交互帧间隔，中位数 120.9 ms，P95 166.6 ms，约 8 帧/秒的中位表现仍有可见卡顿。实体手机的性能与实际显存用量尚未实测。场景限制桌面 DPR 1.5、移动 DPR 1.25，帧率上限分别为 30 和 24。页面失焦或隐藏时暂停连续绘制，档案展开时停止海面动画。数据见 `.local/works-a4/browser-report.json`。

`pnpm check` 通过，包含世界校验、TypeScript 和 Next.js 静态构建。替换前版本保留在 `5477fed`。
