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

## G2 · 材质、烘焙与 WORKS 验收

重新打开源文件并比对 3,956 个对象的顶点、面、层级、变换及倒角参数，均与 G1 一致。沿用 Harvest 的两张内嵌 512 × 512 PBR 图集，按石材、青灰屋面、木作和金属分配材质与 UV。拱廊、檐下、窗龛、阶梯和家具的接触 AO 与柔和日照遮挡烘入不透明批次的角点颜色。网页保留主立面、拱廊和档案家具的倒角，省去部分默认视角下不足一像素的倒角。带厚度的窗格采用独立的单面透明 PBR，暖灯使用独立的低强度发光材质。将页港的模型方位设为 15°，对齐 G1 正面图的水平观察角度。正面、侧后方、最高可达的俯角和放大视图都可观察到窗框和庭院构件。

| Chrome 157，1440 × 900，DPR 1 | GLB 字节 | 主画面三角面 | 每次重绘 Draw Calls |
| --- | ---: | ---: | ---: |
| 页港 G2 | 1,873,704 | 93,110 | 3 主画面 |
| Harvest H2 | 891,716 | 40,610 | 3 主画面 |
| 折光屿 L2 | 1,081,908 | 52,462 | 8 主画面 + 1 透射预通道 |
| 远拍岛 S2 | 1,111,248 | 58,340 | 9 主画面 + 4 透射预通道 |

轮盘首屏的 18 张卡片未发出 GLB 或 Draco 请求，也未创建 WebGL 上下文。依次进入八座岛屿，各自只请求自己的模型，其余七座的绘制数与 S2 记录一致。页港静止时没有持续重绘，连续五次打开及退出均释放缓冲、纹理和 WebGL 上下文。慢速加载中途退出后可再次进入。阻断模型或禁用 WebGL 时仍显示静态预览与项目档案。

Chrome 实测 1920、1440、960、390、320 px。拖动、触屏捏合、缩放、重置视角、键盘、作品切换与返回后的焦点恢复通过。`pnpm check` 通过。[WORKS 网页截图](./renders/web-front.webp) · [正式 GLB](../../../public/works/islands/gopher-atlas.glb) · [正式渲染器生成的 560 × 420 透明预览](../../../public/works/previews/gopheratlas.webp)

从更新后的 Blender 源文件复现导出，并核对 GLB 的 SHA-256 一致。从 G1 源文件开始时，可追加 `--blend` 和保存路径生成带内嵌图集的源文件。

```powershell
blender --background assets/works/gopher-atlas/gopher-atlas.blend --python-exit-code 1 --python assets/works/gopher-atlas/bake_web.py -- --glb public/works/islands/gopher-atlas.glb
```
