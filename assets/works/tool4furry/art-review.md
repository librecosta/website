# 创作者工坊 · The Makers’ Studio

WEB-V0.1-W4-T1。主工作室以高低两片折边金属屋面夹出连续采光带，前部是敞开的工作区和暖木地板。较低的备料翼有纸张压辊、库存格和通往主室的短梯。东翼露台布置可折叠的打样架和调色台。石阶从码头上到跨院步道，分别通向备料区、主入口和东侧歇脚台。背立面设维护门、带栏杆的落脚平台、檐沟和屋面排风罩。

## 产品依据

核对 Tool4Furry `develop` 的 `a14429a384b2cd7df6fc475f5a30642560a368fa`。将裁剪工具的尺寸和构图控制转化为带刻度、限位框和锁止件的定位台，将图像比较转化为同桌双联样张。提色工作流落实为露台上可逐张比较的实物色卡。石墨骨架、浅灰折边屋面和温暖木构构成主体，Lavender 只出现在定位条、抽屉拉手和样张。品牌图形、字标和工具像素图标仅作研究参考。 [产品 README](https://github.com/librecosta/tool4furry/blob/a14429a384b2cd7df6fc475f5a30642560a368fa/README.md) · [视觉基准](https://github.com/librecosta/tool4furry/blob/a14429a384b2cd7df6fc475f5a30642560a368fa/docs/visual-foundation.md) · [品牌资产](https://github.com/librecosta/tool4furry/tree/a14429a384b2cd7df6fc475f5a30642560a368fa/public/brand)

## Blender 审阅

- [正面等距](./renders/front.png)可见采光带、两处入场路线和室外打样台。
- [侧后方](./renders/rear.png)展示背侧服务平台、连续窗、滴水檐与三层闭合岩体。
- [顶部](./renders/top.png)可读四段阶梯、拐弯铺地和屋面层次。
- [主工作室特写](./renders/studio.png)展示屋面接缝、厚玻璃、木柱连接件和入口。
- [打样区特写](./renders/workbench.png)展示原创建模样张、支架枢轴、色卡、家具与露台护栏。
- [室内特写](./renders/interior.png)展示定位台滑轨、纸样、归档格、双联工作位和木屋架。
- [五岛同尺度对照](./renders/comparison.png)直接读取 Harvest H2、Liquid Glass L2、SoFarAway S2 和 GopherAtlas G2 的 Blender 源文件。五座岛共用光照和正交镜头，最长轴统一为 23 Blender 单位。工坊沿岸展开，细节主要集中在连续采光带、开放工作区及室内外工作设施。

在 Blender 5.3 重新打开成品，核对 2,154 个可编辑对象、六台相机和三块闭合岩体。四段阶梯的 27 级踏面通过 405 次地形射线采样。主工作室、备料间和打样平台通过植被净空检查。`pnpm check` 通过。

## 复现

[可编辑 Blender 源文件](./tool4furry.blend)按地形、步道、工作室、备料翼、打样区和植被分 Collection。几何、基础材质和带颜色的样张均存于文件内。建模复用仓库的基础几何、地形与审阅灯具。

```powershell
blender --background --factory-startup --python-exit-code 1 --python assets/works/tool4furry/build.py -- --output .local/tool4furry-t1/rebuild --renders front rear top studio workbench interior
blender --background --factory-startup --python-exit-code 1 --python assets/works/tool4furry/review.py -- --source .local/tool4furry-t1/rebuild/tool4furry.blend --scratch .local/tool4furry-t1/compare --output .local/tool4furry-t1/comparison.png
```

## T2 · 烘焙与 WORKS 验收

在 Blender 5.3 复开并比对 T1 的 2,154 个对象。几何、层级、变换和倒角参数一致，网页保留全部倒角。沿用 Harvest 的 UV 投影与两张 512 × 512 内嵌 PBR 图集，按表面保留木材顺纹、石材、折边金属与五金的亮度、粗糙度和金属度变化。屋檐、台阶、窗龛、护栏和家具的接触 AO 与柔和日照遮挡烘入不透明批次的角点。浅灰屋面收敛到中性冷灰，Lavender 集中在滑轨、拉手和样张。

清透窗与漫射采光带沿用 T1 的实体厚度。网页分别用正面 PBR 混合和 16%／33% 不透明度来保留低反射的窗面及采光带，降低多层窗格对室内观察的影响。正面、两侧斜视、背面和 1.65 倍缩放下检查了木梁、工位、备料家具、双联样张和室外色卡，交叠窗格仍可透视室内。暖灯以独立低强度发光材质呈现。WORKS 的模型方位为 71°，接近 T1 正面图的水平观察角度。

| Chrome 157，1440 × 900，DPR 1 | GLB 字节 | 主画面三角面 | 每次重绘 Draw Calls |
| --- | ---: | ---: | ---: |
| 创作者工坊 T2 | 1,831,560 | 91,354 | 4 |
| Harvest H2 | 891,716 | 40,610 | 3 |
| 折光屿 L2 | 1,081,908 | 52,462 | 8 + 1 透射预通道 |
| 远拍岛 S2 | 1,111,248 | 58,340 | 9 + 4 透射预通道 |
| 页港 G2 | 1,873,704 | 93,110 | 3 |

静态构建在 Chrome 实测 1920 × 1080、1440 × 900、960 × 720、390 × 844、320 × 568。验证拖动、触屏捏合、键盘旋转、缩放、重置、相邻作品切换和回到轮盘后的焦点恢复。18 张卡片首次呈现时的 GLB、Draco 请求和 WebGL 上下文数量均为零。进入八个项目各自只请求对应 GLB，其余七座岛的绘制数与 G2 基准一致。

工坊静止时按需停止重绘，连续五次退出均观测到缓冲、纹理与 WebGL 上下文释放。慢速加载退出后可以再次打开。阻断模型请求或禁用 WebGL 时，560 × 420 静态预览与项目档案均正常显示。`pnpm check` 通过。[WORKS 正面](./renders/web-front.webp) · [窗格近景](./renders/web-glazing.webp) · [正式 GLB](../../../public/works/islands/tool4furry.glb) · [正式渲染器生成的透明预览](../../../public/works/previews/tool4furry.webp)

从更新后的源文件复现导出，核对 GLB 的 SHA-256 一致。若从 T1 版本开始，可追加 `--blend` 和另存路径得到内嵌材质图集的可编辑源文件。

```powershell
blender --background assets/works/tool4furry/tool4furry.blend --python-exit-code 1 --python assets/works/tool4furry/bake_web.py -- --glb public/works/islands/tool4furry.glb
```
