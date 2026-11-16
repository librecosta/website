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

## S2 · 材质、烘焙与 WORKS 验收

重新打开更新后的 Blender 源文件，核对全部 2,470 个对象的几何、变换、层级和倒角参数与 S1 一致。深色承重梁、金属护壁、紧固件、控制设施及岩面共用两张内嵌的 512 × 512 PBR 图集。软日照的遮挡和接触 AO 烘入不透明几何的顶点色。导出保留航道护壁、观察窗和门体的主要倒角，省去部分在默认视角下不足一像素的小倒角。三组青绿、青蓝和琥珀材质提供静态节拍灯。

航道天幕和门体采用独立的分层透明 PBR，控制舱观察窗保留 glTF 体积透射。对比过航道全透射方案，最终采用分层混合以显示后方的玻璃边、真实开口和节拍灯。检查正面、侧后方、轴向和缩放视角，导出的 Draco 模型也通过五种门洞的射线验证。[glTF 透射规范](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_transmission/README.md)

| Chrome 157，1440 × 900，DPR 1 | GLB 字节 | 模型三角面 | 每次重绘 Draw Calls |
| --- | ---: | ---: | ---: |
| 远拍岛 S2 | 1,111,248 | 58,340 | 9 主画面 + 4 透射预通道 |
| Harvest H2 | 891,716 | 40,610 | 3 主画面 |
| 折光屿 L2 | 1,081,908 | 52,462 | 8 主画面 + 1 透射预通道 |

远拍岛的透射预通道额外提交 53,452 个三角面，按画布尺寸的 75% 绘制。静止时浏览器没有持续的 WebGL 绘制。轮盘首屏没有 WebGL、GLB 或 Draco 请求，打开各项目分别核对模型请求。连续五次打开及退出远拍岛，均回收缓冲、纹理和帧缓冲并关闭 WebGL 上下文。模拟慢速网络中途退出，再次进入可正常加载。阻断 GLB 和禁用 WebGL 时均显示静态图与项目档案。

在 Chrome 检查 1920、1440、960、390、320 px，移动端使用触屏模拟。通过拖动、缩放、视角重置、键盘、前后切换和回到轮盘后的焦点检查。`pnpm check` 通过。 [WORKS 实际截图](./renders/web-front.webp) · [正式 GLB](../../../public/works/islands/sofaraway.glb) · [正式渲染器生成的 560 × 420 透明预览](../../../public/works/previews/sofaraway.webp)

从当前 Blender 源文件可复现同一份 GLB。从 S1 源文件制作时，追加 `--blend` 和保存路径可保存深化后的源文件。

```powershell
blender --background assets/works/sofaraway/sofaraway.blend --python-exit-code 1 --python assets/works/sofaraway/bake_web.py -- --glb public/works/islands/sofaraway.glb
```
