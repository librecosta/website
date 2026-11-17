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

## GF2 待办

深化陶瓦、切石、木板和屋面金属的表面质感，整理 UV 并烘焙檐下、廊柱和踏步接触阴影。玻璃保留独立材质，正式导出时检查透过展馆窗格的可见性。完成合批与几何压缩后，再用站内单岛渲染器检查轮廓、灯光和近景材质并生成正式轮盘预览。
