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
