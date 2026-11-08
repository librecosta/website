# P1-C1B0 · Hubtown 立方体表面研究

## 自行核实的公开实现

研究对象为 2026-11-08 的 Hubtown 首页。直接核对了公开入口 JavaScript、浏览器中的 WebGL 2 资源请求，以及 GLB 的 JSON chunk 和 KTX2 文件头。浏览器资源记录来自回环地址对公开文件的回放。[Hubtown 官网](https://hubtown.co.in/) · [公开入口包](https://hubtown.co.in/_nuxt/u1ipQrxM.js)

- `/webgl/models/scene_1.glb` 为 glTF 2.0，大小 229,424 B，使用 Draco。其 `hero-cube` 节点包含法线与 `TEXCOORD_0/1/2`，文件没有材质或内嵌贴图。主立方体的材质由运行时代码绑定。
- 首页请求了五张独立的 `hero-cube-*.ktx2`。AO、grid、edges、details 均为 1024 × 1024，hex 为 512 × 512。源码的加载器把图像路径映射到对应的 KTX2，并通过 Basis 解码；GLB 走 Draco 解码。
- 立方体 Shader 用三色渐变与随时间变化的噪声塑造主体光色，`tAO` 取自首套 UV；`tGrid`、`tEdges` 和 `tDetails` 在第二套 UV 上取样，用对比度、阈值与强度组织面板与亮线；第三套 UV 用于渐变与 hex reveal。另有视角 Fresnel、基于局部坐标的外棱增强及 HDR 色值增强。纹样绘制在 Shader 中，分区和细线依赖二维纹理；参考画面的主切口和大轮廓单独由模型承担。
- 公开代码构造了独立的多级 Bloom Pass。入口默认 threshold 0.21、strength 0.24、radius 0.04，同时还有 FXAA 与最终合成。Shader 的色值增强与屏幕空间辉光是两个环节，不能从 `uBloomColor` 单独推断最终辉光。

### GPU 帧验证与范围

独立 Chrome 调试端口启动被自动审批拒绝。未改动浏览器配置。通过本地 HTTP 回放记录浏览器实际请求，并在回放页接入 Spector.js 0.9.33。完整回放因后续场景的地图与地形法线资源超时而中断，最终只隔离首页场景的构建与转场，保留首页模型、Shader、纹理和后期代码，成功捕获一帧。记录保存在本地 `.local/hubtown-study/reference/`。[Spector.js](https://github.com/BabylonJS/Spector.js)

- 捕获在 1280 × 720 的 WebGL 2 画布进行。Spector 的 draw #223 对应 GLB 中 108 个索引的立方体，绑定了 AO、grid、edges、details、两张 256 × 256 噪声图与 512 × 512 reveal 图。实际 `uGridTextureStrength` 为 1.5，`uGridEdgesStrength` 为 0.35，`uFresnelAddition` 为 3。该帧的 `uDetailsScale` 为 0，意味着 details 图虽绑定，按该段采样公式只取定点，不能把画面的细线归给它。
- Draw #285 做亮度提取，之后为五级横纵模糊、合并及叠加。实际 threshold 0.20、strength 0.38、radius 0.60，与入口默认值不同。该次捕获含 48 个绘制调用，覆盖首页多次渲染和后期，仅用于确认实际流程。
- 本次只确认隔离回放这一帧。原站完整导航、不同时间点与 GPU 档位的配置、商业原始分层工程、整站帧耗时仍未核实。

Animorio 的文章另有对移动噪声、AO、网格、细节层、Fresnel 与辉光的说明。本文的资源名、UV、纹理尺寸及参数来自以上自行核对；作者的可视化拆解是独立的第三方材料。[Animorio 拆解](https://animorio.com/en/journal/hubtown-how-its-made/)

## 独立重建

运行 `pnpm dev` 后打开 `/lab/cube-surface`。固定三分之四机位可查看完整合成、Base Color、Panel Mask、Fine Lines、Fresnel、Emissive 与 Bloom Only，亦可在合成视图开关 Bloom、调节发光。每个视图只在设置或尺寸变化时重绘。

原创矩形、折线路径与局部强调区绘制为 3 张 1024 × 1024 的 RGB 数据掩码，供 6 面复用。R 控制低对比面板，G 控制二维细线，B 控制局部发光，颜色在 Shader 内线性混合。掩码使用 mipmap 与各向异性采样。箱体平面保持完整，细线没有位移、凹槽或法线偏移。HDR 合成经过可关闭的 `UnrealBloomPass`，最终由 `OutputPass` 做 ACES 映射和显示转换。[Three.js UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html)

同一机位的开关对照中，关闭 Bloom 后面板、细线和立方体明暗仍可辨认。打开后，棱边附近出现柔和光晕。立方体的蓝色仅用于验证参考中的层次。独立实验聚焦静态表皮，参考中的主切口、动态光色与环境反射留在参照侧。参考与实验、Bloom 开关及各通道的截图留在本地 `.local/hubtown-study/comparison/`。

### 实验性能

Chromium 157（Windows 内置浏览器），AMD Radeon 集显／ANGLE D3D11，DPR 1，视口 1280 × 720，实际画布 1280 × 600。固定机位预热后强制重绘，使用 `EXT_disjoint_timer_query_webgl2`，每种状态 30 个有效 GPU 样本，未发生 disjoint。耗时从每次重绘的首次 draw 开始计，属于单次渲染成本。

| 合成状态 | Draw Calls | GPU 平均 | GPU P95 |
| --- | ---: | ---: | ---: |
| Bloom 关闭 | 7 | 1.62 ms | 1.92 ms |
| Bloom 开启 | 20 | 3.19 ms | 4.07 ms |

## 主碑 UV 判断

主碑已有按面的纹样图表与独立槽口、倒角几何。下一轮可先用现有图表承载原创矢量纹样及亮度掩码，沿用暖灰基底。若设计明确要求图案跨正面、侧面、倒角或槽口连续，再对现有网格做局部 UV 展开与烘焙。此轮无需导出 Blender。

## P1-C1A3 · 主碑平面纹样

正面围绕真实纵缝组织：槽顶上方用一组阶梯折线收束，中上部的两个对向几何符号隔缝呼应，下半部拉开折线与分区间距，保留大片暖灰平面。两侧使用更疏的错位分区和短折线，沿用正面的转折规律；纹样停在棱边之前，顶面和槽内留白。直接使用现有随碑体收分的坐标，不需额外展开 UV。

沿用立方体实验的分层方法，布局为主碑重新绘制。启动时按需将三个面写入一组带 mipmap 的 `384 × 960 × 3` 数据纹理：R 是面板，G 是细线，B 是局部发光。基底保持 `#a69e91`；面板只微调反射颜色和粗糙度，纹样不写入位移、法线或凹槽遮蔽。少数线段带低强度暖白发光，掠射方向略微提亮。Bloom 只在近处对发光遮罩做约 1.7 渲染像素的局部扩散，无额外绘制，也不会越过碑体轮廓；此效果不能替代跨物体的镜头辉光。

用 `pnpm dev` 打开 `/lab/expanse?debug=1`，在「主碑材质」中切换专属纹样、旧纹刻研究或灰模。新版可单独查看基础色、面板、细线、Fresnel、局部发光，也可关闭光晕对比完整合成。使用 0%、35%、100% 三个按钮对照：中景对应原旅程的 35.6%。

在 Windows Chromium／AMD Radeon 集显（ANGLE D3D11）以 1280 × 720、DPR 1、静态风沙基线采集三组画面。同一机位的新旧版本拥有相同的相机姿态与 FOV，均为 5 次绘制和 353,277 个三角面，像素差异仅在主碑。远景细线随空气透视弱化，中景主要读到面板与纵缝，终点可辨认对向符号；受光侧面的纹样仍比正面更淡。未单独测量 GPU 时间。对照截图与分层截图留在本地 `.local/monument-transfer/`。
