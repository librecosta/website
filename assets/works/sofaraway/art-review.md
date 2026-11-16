# 远拍岛 · The Beatline

WEB-V0.1-W3-S1。原创 Blender 微缩岛屿，主题为节拍飞行试验场。航道从较高的发射台伸出，穿过断层上方的加宽段，再由较低的终点岩台托住。三处岩基支承、下方桁架和低位检修桥共同建立尺度和高差。

## 游戏依据

核对 SoFarAway `dev` 的 `17bd113212c8c04c1f2ad380241262bdb4f0c0ff`。ELSEWHERE 的八边形护壁、节奏灯和有固定中心的虹膜门，接续 DAYBREAK 的透明天幕及几何开口。变密与留空的灯组表现飞行节奏，门型沿同一条航道变化。岩层竖井是原创的检修设施，内设导轨、卷扬机和下降平台。

- [README](https://github.com/librecosta/sofaraway/blob/17bd113212c8c04c1f2ad380241262bdb4f0c0ff/README.md) · [实际游戏截图](https://github.com/librecosta/sofaraway/tree/17bd113212c8c04c1f2ad380241262bdb4f0c0ff/shots)
- [关卡和节拍配置](https://github.com/librecosta/sofaraway/blob/17bd113212c8c04c1f2ad380241262bdb4f0c0ff/app/game/core/volumes.ts) · [航道](https://github.com/librecosta/sofaraway/blob/17bd113212c8c04c1f2ad380241262bdb4f0c0ff/app/game/graphics/tunnel.client.ts) · [玻璃门](https://github.com/librecosta/sofaraway/blob/17bd113212c8c04c1f2ad380241262bdb4f0c0ff/app/game/graphics/gates.client.ts)
- [ELSEWHERE 航道与灯光契约](https://github.com/librecosta/sofaraway/blob/17bd113212c8c04c1f2ad380241262bdb4f0c0ff/docs/contracts/D0-B3-A1-F2-long-corridor-lighting-s-curve.md) · [玻璃光学契约](https://github.com/librecosta/sofaraway/blob/17bd113212c8c04c1f2ad380241262bdb4f0c0ff/docs/contracts/D0-B1-procedural-glass-optics.md) · [DAYBREAK 世界连续性契约](https://github.com/librecosta/sofaraway/blob/17bd113212c8c04c1f2ad380241262bdb4f0c0ff/docs/contracts/D1-B0-daybreak-gameplay-world-continuity.md)

## 渲染验收

- [正面等距](./renders/front.png)展示连续航道、控制舱、码头和三级岩基承重。
- [侧后方](./renders/rear.png)展示检修桥、背侧维修间、航道入口和岩层错动。
- [顶部](./renders/top.png)可追踪轻微偏转的航道、码头至控制舱的路线与下沉竖井。
- [航道特写](./renders/flight.png)展示玻璃天幕、换段伸缩机构、桁架和终端设备。[沿轴线特写](./renders/apertures.png)展示真实开口、玻璃厚边和节拍灯组。
- [控制设施特写](./renders/control.png)展示舱内工作位、架空连桥、铜顶压缩机间和竖井卷扬机。
- [同尺度对照](./renders/comparison.png)将远拍岛、Harvest H2、Liquid Glass L2 和 Wenz 的 Bay、Foundry、Signal 在独立 Blender 场景中渲染。各岛最长轴统一为 23 Blender 单位，共用正交相机尺度和灯光。远拍岛用悬空航道形成长向剪影，近景细节集中在门框、玻璃、设备和连接处。Wenz 模型仅用于对照。[参考资产与授权](../../../public/works/asset-notices.txt)

使用 Blender 5.3 Cycles 渲染。重新打开源文件，确认 2,470 个可编辑对象、38,918 个基础三角面、六台正交相机和四盏灯，全部数据随源文件保存。复核三块地形和 110 件玻璃的闭合及外法线，验证五种门的通行口和实体部分，以及竖井深度、楼梯和检修桥踏面的地形净空。`pnpm check` 通过。

## 复现

```powershell
blender --background --factory-startup --python-exit-code 1 --python assets/works/sofaraway/build.py -- --output .local/sofaraway-s1/rebuild --renders front rear top flight apertures control
blender --background --factory-startup --python-exit-code 1 --python assets/works/sofaraway/compare.py -- --scratch .local/sofaraway-s1/compare --output .local/sofaraway-s1/comparison.png
```

[可编辑 Blender 源文件](./sofaraway.blend)包含独立地形、航道、建筑、维护步道、竖井与植被 Collection，以及已有厚度的玻璃和基础 PBR 配色。交付内容用于 S1 美术验收。
