# 铆湾 · The Discovery Harbor

WEB-V0.1-W4-GF1。登岛后沿弧形岸路经石阶到中央广场。暖橙色拱顶覆盖开放式导航主馆，低一层的侧廊连到木露台。西侧的资源导览亭用开放展架和长凳承接浏览与停留，东侧的游戏展馆有独立折屋顶、可从窗外看见的展示设施，以及通往岬角观景台的支路。主馆背后留有一条绕行步道。三段台地高差、浅色岸线和木栈桥组成连续的登岛路线。

## 产品研究

对照 GoFurry `develop` 的 `fcff5dad2b4c867eb7eeda483e21f5544ab70979`，查看正式字标与配色、桌面和移动端截图，以及起始页、站点导航和游戏发现实现。起始页把搜索、快捷访问和个性化工具集中在同一入口，因此主馆保留一条明确的进场轴线和可自由穿行的侧廊。站点与游戏拥有独立的浏览路径，岛上也有各自的导览亭和展馆。品牌色 `#E5583D` 和 `#FFDEC2` 用在屋顶与遮阳细节，暖白石材与青灰色金属作为主要建筑配色。 [项目说明](https://github.com/librecosta/gofurry/blob/fcff5dad2b4c867eb7eeda483e21f5544ab70979/README.md) · [品牌资产](https://github.com/librecosta/gofurry/tree/fcff5dad2b4c867eb7eeda483e21f5544ab70979/apps/web/public/brand) · [起始页](https://github.com/librecosta/gofurry/tree/fcff5dad2b4c867eb7eeda483e21f5544ab70979/apps/web/src/start) · [站点导航](https://github.com/librecosta/gofurry/blob/fcff5dad2b4c867eb7eeda483e21f5544ab70979/apps/web/src/navigation/pages.tsx) · [游戏发现](https://github.com/librecosta/gofurry/blob/fcff5dad2b4c867eb7eeda483e21f5544ab70979/apps/web/src/games/pages.tsx) · [桌面和移动端截图](https://github.com/librecosta/gofurry/tree/fcff5dad2b4c867eb7eeda483e21f5544ab70979/docs/figures/d2-b)

## Blender 验收

- 正面检查暖橙拱顶、两翼高度差、岬角和弧形港岸的整体轮廓。 [正面等距](./renders/front.png)
- 从侧后方检查拱顶收边、后窗、背部岩层和绕行步道。 [侧后方](./renders/rear.png)
- 顶视检查中心广场到两翼、岬角和码头的连通，以及木露台与石铺面的交接。 [顶部](./renders/top.png)
- 放大检查拱券、屋面立缝、梁柱、栏杆、室内陈列、码头支撑与植物落位。 [导航主馆](./renders/pavilion.png) · [港湾和发现设施](./renders/harbor.png)
- 在 Blender 中加载六座已完成岛屿的源文件，统一最长轴为 23 Blender 单位，采用相同的正交镜头和灯光重渲染。铆湾的前部低湾与宽拱顶保留了清楚的剪影，面向港口的大开口也让主馆的内部结构在缩小后仍可分辨。 [七岛对照](./renders/comparison.png)

Blender 5.3 中复开源文件，并从保存的场景重新渲染。地形、码头、步道、建筑、家具和植被均按 Collection 分组，保留独立对象、材质槽、五台正交相机及基础灯光。所有几何与基础材质均为本次原创。五块地形均为闭合实体。五段楼梯的 30 级踏面在 450 个地形采样点上均未穿入岩体。`pnpm check` 通过。 [可编辑源文件](./gofurry.blend)

## 复现

从仓库根目录运行。支持在有对应设备时为两条命令追加 `--device OPTIX` 或 `--device CUDA`。

```powershell
blender --background --factory-startup --python-exit-code 1 --python assets/works/gofurry/build.py -- --output .local/gofurry-gf1/rebuild --renders front rear top pavilion harbor
blender --background --factory-startup --python-exit-code 1 --python assets/works/gofurry/review.py -- --source .local/gofurry-gf1/rebuild/gofurry.blend --scratch .local/gofurry-gf1/scale --output .local/gofurry-gf1/rebuild/renders/comparison.png
```

## GF2 正式资产

保留 GF1 的几何、布局和建筑色值。陶瓦使用非金属粗糙度和轻微窑色，切石、木构、锌板及地形分别使用对应的表面细节。两张 512 × 512 PBR 图集打包在源文件内，柔和日照遮挡与接触 AO 烘焙为面角颜色。`Discovery Harbor · Web bake` 场景保留合批后的 UV、法线及烘焙结果。窗格采用单面低透明度 PBR 材质，暖灯采用独立发光批次。 [正式 GLB](../../../public/works/islands/gofurry.glb) · [素材许可](../../../public/works/asset-notices.txt)

使用静态生产构建，在 Chrome 157、AMD Radeon 上检查正面、侧后方、低视角和放大。拱顶瓦片、拱券接缝和五金结构仍可辨认，斜视展馆窗格时能看到陈列台和室内陈列。核对 1920 × 1080、1440 × 900、960 × 720、390 × 844、320 × 568 的布局，移动端使用浏览器视口与触摸模拟。通过拖动、键盘旋转、双指缩放、重置、前后切换与返回焦点检查。轮盘首屏的 WebGL 上下文、GLB 和 Draco 请求均为零，八座岛可各自加载。连续五次进入和退出 GoFurry，每次释放 15 个缓冲区、3 个纹理并丢弃旧 WebGL 上下文。阻断 GLB 或禁用 WebGL 时显示 560 × 420 的透明 WebP 回退。预览从正式单岛渲染器以 1.5 DPR 捕获，沿用详情页相机与灯光。`pnpm check` 通过。 [正式轮盘预览](../../../public/works/previews/gofurry.webp)

| 模型 | GLB 字节 | GLB 三角面 | 浏览器屏上 Draw Calls |
| --- | ---: | ---: | ---: |
| GoFurry GF2 | 1,826,616 | 81,340 | 3 |
| Harvest | 891,716 | 40,610 | 3 |
| Liquid Glass | 1,081,908 | 52,462 | 8 |
| SoFarAway | 1,111,248 | 58,340 | 9 |
| GopherAtlas | 1,873,704 | 93,110 | 3 |
| Tool4Furry | 1,831,560 | 91,354 | 4 |
| Wavefield | 933,268 | 113,576 | 7 |

从当前源文件重烘并导出，已与正式 GLB 比对 SHA-256。在 GF1 源文件上运行时可追加 `--blend <路径>` 保存带材质、UV 和完整烘焙场景的可编辑版本。

```powershell
blender --background assets/works/gofurry/gofurry.blend --python-exit-code 1 --python assets/works/gofurry/bake_web.py -- --glb public/works/islands/gofurry.glb
```
