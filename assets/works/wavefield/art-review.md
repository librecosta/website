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

## WF2 正式资产

保留 WF1 的构图、33 根经线、45 根纬线及缆端位置。经线实体截面放大至原来的 1.39 倍，纬线放大至 1.19 倍。浅银蓝色集中在原有波脊，边缘透过双面薄纱逐渐融入背景。偏冷日光照出灰绿台地与青灰岩面，浅木栈道和工坊暖灯保留色温差。 [WF2 Blender 源文件](./wavefield-final.blend)

不透明结构使用两张打包的 512 × 512 PBR 图集，接触 AO 与柔和日照遮挡烘入顶点色。经纬线保留独立的 PBR 批次与实体深度，薄纱使用带顶点透明度的双面 alpha blend，工坊玻璃与工作灯各自分批。 [正式 GLB](../../../public/works/islands/wavefield.glb) · [资产与许可](../../../public/works/asset-notices.txt)

在 Chrome 157（AMD Radeon，WebGL 4× MSAA）上验证静态生产构建。测试视口为 1920 × 1080、1440 × 900、960 × 720、390 × 844 和 320 × 568。检查默认、缩小、放大、侧后、顶部及低角度，主波脊保持可辨，最窄视口的细纬线较柔和。浏览器验证了鼠标拖动、触摸缩放、键盘、视角重置、退回轮盘与焦点恢复。八座岛均可依次独立加载，轮盘首屏的 WebGL 上下文及岛屿与 Draco 请求均为零。阻断 GLB 或禁用 WebGL 时显示静态回退。连续五次打开和退出均释放了对应 WebGL 上下文、缓冲区与纹理。移动端采用 Chrome 触摸和视口模拟。

GLB 为 933,268 bytes，113,576 三角面，6 个 Draco primitive。浏览器实测每帧 7 次屏上绘制，双面透明薄纱分两次提交，合计 125,864 个三角形。离屏绘制为零，停止操作后按需渲染回到静止。两张 WebP 从正式单岛渲染器以 1.5 DPR 捕获，正交角度、光照与查看器一致。 `pnpm check` 通过。 [轮盘及回退 560 × 420](../../../public/works/previews/wavefield.webp) · [档案 768 × 432](../../../public/works/wavefield-preview.webp)

从 WF1 源文件可重做材质与烘焙。把命令中的输入替换为 `wavefield-final.blend` 并去掉 `--blend` 也可重建同一份 GLB，已比对 SHA-256。

```powershell
blender --background assets/works/wavefield/wavefield.blend --python-exit-code 1 --python assets/works/wavefield/bake_web.py -- --blend assets/works/wavefield/wavefield-final.blend --glb public/works/islands/wavefield.glb
```
