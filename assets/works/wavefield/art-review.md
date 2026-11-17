# 回波岬 · The Wave Loom

WEB-V0.1-W4-WF1。三道高低、宽度和朝向各异的波脊跨过凹谷。西侧的紧凑张力架邻接带玻璃山墙的校准工坊，东侧的外展支撑留出观测平台和测量工位。从小型码头经岸边栈道和四段楼梯可到两侧设备。层状岩肩承接建筑基座，东侧栈道外角由斜撑接入基岩。

## Wavefield 参考

核对 Wavefield `main` 的 `ae01299725e49075069f63b5566d1638d753f377`。从实际预览和实现提取连续高度场、主次双向线、宽窄不同的峰，以及受焦点约束的局部高光。岛屿采用原创的非对称曲面和结构。33 根经向纤维、45 根较细的纬向纤维与半透明底纱共用同一组空间坐标，纤维有实体截面。线宽、色值和底纱覆盖率在边缘逐渐降低，银蓝高光集中在两段前部波脊。 [项目 README](https://github.com/librecosta/wavefield/blob/ae01299725e49075069f63b5566d1638d753f377/README.md) · [实际 WebGPU 预览](https://github.com/librecosta/wavefield/blob/ae01299725e49075069f63b5566d1638d753f377/docs/assets/wavefield-preview.webp) · [重建记录](https://github.com/librecosta/wavefield/blob/ae01299725e49075069f63b5566d1638d753f377/docs/articles/webgpu-wavefield-reconstruction.zh-CN.md) · [高度场](https://github.com/librecosta/wavefield/blob/ae01299725e49075069f63b5566d1638d753f377/src/wave/gpu-terrain.ts) · [线条渲染](https://github.com/librecosta/wavefield/blob/ae01299725e49075069f63b5566d1638d753f377/src/wave/gpu-shaders.ts)

## Blender 验收

- 正面等距检查波脊轮廓、岩肩和登岛路径。 [正面](./renders/front.png)
- 从侧后方检查完整岩壁、工坊背窗、外侧检修平台和背面的波场。 [侧后方](./renders/rear.png)
- 顶视检查双向纤维连续性、张力架的非对称布置以及四段楼梯与栈道的连接。 [顶部](./renders/top.png)
- 近景检查经纬线粗细、两组轴承、陶瓷导槽、紧固件、屋面收边与玻璃山墙。 [波场特写](./renders/surface.png) · [支撑与工坊特写](./renders/structure.png)
- 直接载入 Harvest、Liquid Glass、SoFarAway、GopherAtlas、Tool4Furry 的 Blender 源文件。六座岛最长轴统一为 23 Blender 单位，采用同一正交镜头和灯光。 [六岛对照](./renders/comparison.png)

在 Blender 5.3 复开交付源文件，波场、两侧机械、地形、工坊、植被按 Collection 独立编辑，五台正交相机和基础材质均随文件保存。海岸基岩和左右岩肩均为闭合实体。四段楼梯的 27 级踏面通过 405 次地形采样。66 个经线端点与两侧陶瓷导槽逐一对齐。 `pnpm check` 通过。 [可编辑源文件](./wavefield.blend)

## 复现

```powershell
blender --background --factory-startup --python-exit-code 1 --python assets/works/wavefield/build.py -- --output .local/wavefield-wf1/rebuild --renders front rear top surface structure
blender --background --factory-startup --python-exit-code 1 --python assets/works/wavefield/review.py -- --source .local/wavefield-wf1/rebuild/wavefield.blend --scratch .local/wavefield-wf1/scale --output .local/wavefield-wf1/rebuild/renders/comparison.png
```

有 NVIDIA 渲染设备时可在命令末尾追加 `--device OPTIX`。

## WF2 待办

完成正式 PBR、接触 AO 与日照烘焙。在 Three.js 里验证双面观察、底纱排序和细线远景抗锯齿，再决定波场材质的合批与几何预算。
