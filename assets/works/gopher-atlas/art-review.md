# 页港 · The Atlas Observatory

WEB-V0.1-W3-G1。三层海岸台地上的图志观测站。乳白切石拱廊、青灰屋面、风化金属和深色木构跨过高差，少量暖灯沿阅读路线布置。上层前廊由独立柱脚承重，东翼露台的低矮照准仪与石质测绘基准共用平台。下层庭院可在地面方位盘旁操作实体地形图台。

## 阅读路径

对照 GopherAtlas `main` 的正式定位。Learning Notes 的入口连接手稿工作室与参考书架。Curated Articles 的阅读室设有导读桌和独立编目抽屉。Topics 沿带展龛的拱廊组织精选文章的阅读顺序，建筑上连缀前部公共步道、阅读室侧门和通往上层的西侧阶梯。[GopherAtlas 关于页面](https://github.com/deepfurry/gopher-atlas/blob/1f730584d7b3b585bfa142fa90d9a9714a607e21/apps/web/src/content/chrome/about.zh.md)

## Blender 渲染验收

- [正面等距](./renders/front.png)展示从码头、制图庭院到横向档案建筑群的上坡路线。
- [侧后方](./renders/rear.png)展示西侧回廊阶梯、后窗、山墙以及岩层闭合。
- [顶部](./renders/top.png)显示四段阶梯、连续铺地和各建筑入口的关系。
- [主档案馆特写](./renders/archive.png)可辨拱券、斜顶瓦片、檐下梁、玻璃窗格和露台测绘装置。
- [制图庭院与阅读廊道特写](./renders/courtyard.png)展示铺地嵌入的方位盘、分层地形图、野外测绘仪和廊柱。
- [同尺度对照](./renders/comparison.png)直接读取 Harvest H2、Liquid Glass L2 和 SoFarAway S2 的 Blender 源文件。四座岛使用同一正交相机和灯光，最长轴统一为 23 Blender 单位。页港的剪影由横向错层屋顶和连通的台地形成，构件密度集中在门窗、檐口和室内家具。

在 Blender 5.3 中重新打开源文件，确认模型和材质可独立使用，地形、建筑、家具、路径和植被按 Collection 组织。五台审阅相机均采用正交视角，渲染使用 Cycles。三块主体岩体均闭合，四段阶梯的 36 级踏面通过 540 次地形射线采样。`pnpm check` 通过。[可编辑 Blender 源文件](./gopher-atlas.blend)

## 复现

建模脚本复用本仓库 Harvest 的基础几何和远拍岛的正交摄影棚。

```powershell
blender --background --factory-startup --python-exit-code 1 --python assets/works/gopher-atlas/build.py -- --output .local/gopher-atlas-g1/rebuild --renders front rear top archive courtyard
blender --background --factory-startup --python-exit-code 1 --python assets/works/gopher-atlas/review.py -- --source .local/gopher-atlas-g1/rebuild/gopher-atlas.blend --scratch .local/gopher-atlas-g1/compare --output .local/gopher-atlas-g1/comparison.png
```

## G2 验收项

深化石材、青灰屋面与木作。为拱廊、阶梯底面、窗龛和室内家具烘焙接触遮挡。按玻璃与不透明表面分别评估材质合批、远景可读性和透明排序，再验证网页相机与静态预览构图。
