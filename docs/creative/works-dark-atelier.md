# WORKS · WEB-V0.1-A5

基线与回退点为本地 A4 提交 `3cec65f2a811630cc9021c05e11889707889d774`。开始时 `develop` 领先远端跟踪分支两次提交，工作区干净。基线在编辑前从该提交的生产静态产物采集。

## 展陈与渲染

`/works` 的全视口背景由静态 CSS 网格、分区线、十字标记和轻微明暗变化组成。透明 Canvas 显示原有八座岛，保留原几何、贴图、烘焙光影、DPR 上限和抗锯齿。部分岛屿露出之前藏在水面下的岩层。第一幕的 LibreCosta 字形以小型静态 SVG 用于 WORKS，字体直接引用已有 Oxanium 文件。

悬停与键盘聚焦使用视口边缘的项目介绍。选中后，原 Canvas 继续显示世界，相机将岛屿移入展陈区，其余岛屿降低亮度。桌面在右侧显示档案，手机在下部显示，项目入口固定在档案底栏，正文和预览可滚动。作品数据和外链沿用 A4。Amber 提供了标本与信息并置的布局参考，Hubtown 提供了深色环境参考。[Amber 展陈](https://amber.isma.uy/specimens/rex-005) · [Amber 源码](https://github.com/ismamz/amber) · [Hubtown 视觉解读](https://animorio.com/en/journal/hubtown-how-its-made/) · [素材与许可](../../public/works/asset-notices.txt)

删除水面着色、离屏水面目标、岸线距离场和八张泡沫纹理。场景只在模型载入、视口改变、交互或镜头与高亮尚未到位时请求绘制。指针选岛合并到下一帧，减少重复射线查询。页面隐藏暂停调度，离页或卸载时释放 Three.js 资源和 WebGL context，浏览器确实保留在往返缓存中的页面由可见性事件恢复。

## 浏览器与证据

同视口对照材料保存在 `.local/works-a5/`。桌面证据包括 `before-overview-1440.png`、`after-overview-1440.png`、`after-overview-1920.png`、`after-hover-1440.png`、`after-detail-1440.png` 和 `after-index-1440.png`。两种手机尺寸都有改造前后同尺寸总览和 Sofaraway 档案，例如 `before-detail-390.png` 与 `after-detail-390.png`。

## 同条件性能对比

Chrome 157.0.8103.78，Windows，ANGLE Vulkan SwiftShader，1440×900、DPR 1，禁用 HTTP 缓存。使用同一个静态预览地址、脚本和输入序列。总览稳定后静置 2.4 秒，分别复现一段拖动、10 个滚轮输入和 GoFurry 档案的聚焦过渡。首屏指标来自单次导航，首绘为浏览器 First Paint，八岛可见代理值为完整首帧后激活 HTML 标记的时间。

| 指标 | A4 海洋 | A5 工坊 |
| --- | ---: | ---: |
| 首绘 / 八岛就绪 | 300 / 1191 ms | 144 / 828 ms |
| 初始资源传输 | 4,305,730 B | 4,305,550 B |
| 总览 Draw Calls | 50 | 40 |
| 总览 Triangles | 160,414 | 141,964 |
| Geometry / Texture | 50 / 15 | 40 / 6 |
| 总览静置 2.4 秒绘制 | 20 | 0 |
| 档案稳定后 1.3 秒绘制 | 0 | 0 |

| 操作 | 帧间隔 P50 / P95 A4 | 帧间隔 P50 / P95 A5 | WebGL 计时 P50 / P95 A4 | WebGL 计时 P50 / P95 A5 |
| --- | ---: | ---: | ---: | ---: |
| 总览静置 | 120.8 / 125.1 | 无帧 | 113.7 / 118.0 | 无帧 |
| 拖动 | 154.1 / 162.5 | 120.8 / 141.7 | 116.4 / 121.2 | 94.1 / 114.6 |
| 缩放 | 175.0 / 196.1 | 125.2 / 141.7 | 124.2 / 131.7 | 102.6 / 107.9 |
| 选中详情 | 125.1 / 145.8 | 108.3 / 146.0 | 116.1 / 128.0 | 88.8 / 94.0 |

单位为 ms。WebGL 计时由 `EXT_disjoint_timer_query_webgl2` 采集，反映 SwiftShader 软件设备的工作时间。选中时样本较少，P95 没有改善，期间还包含真实预览首次解码与 HTML 面板合成。初始流量实际几乎持平，五份原 GLB 仍占主要部分。首绘和就绪时间在本次样本更短，未据此推断真实网络或设备表现。软件渲染移动镜头时仍能看到卡顿。

两版离开至首页时均无 Canvas 和岛屿请求。A5 在不进入浏览器往返缓存的离页场景中，记录到旧 WebGL context 已释放。重新进入后的 Draw Calls、Geometry 和 Texture 均回到各自的初始总览计数。数据见 `.local/works-a5/before.json`、`.local/works-a5/after.json`。没有采集物理显存字节或真机硬件 GPU 计时。

浏览器在 1440×900、1920×1080、390×844、320×568 逐项打开八份档案与索引入口，检查了全屏无溢出、预览、固定外链和关闭行为。手机通过 Chrome 触屏模拟验证点击、拖动、双指缩放和缩放按钮。320×568 在独立标签完成手势复测，避免连续变更模拟视口影响合成触点。桌面验证了真实岛体悬停、键盘聚焦与 Enter、Tab 焦点边界和 Escape 返回。WebGL 禁用及 context 丢失时可读取八项 HTML 索引，context 恢复后回到世界，关闭 JavaScript 后静态链接仍在。测试未请求海洋、第一幕或音频资产，正常浏览无未捕获异常。具体记录见 `.local/works-a5/qa.json` 与 `.local/works-a5/qa-320-fresh.json`。

`pnpm check` 已通过，包含世界校验、TypeScript 和 Next.js 静态构建。已检查八项项目数据、岛屿资产、首页、The Expanse 与 Lab 的 Git diff，均无更改。
