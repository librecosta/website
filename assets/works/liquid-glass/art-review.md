# 折光屿 · The Refraction Atelier

WEB-V0.1-W3-L1 的原创微缩岛屿，供 Blender 美术验收。场景内有独立的地形、建筑、光学装置、测试庭院、路径、植被和道具 Collection，另设审阅相机和基础灯光。模型、材质和灯光都包含在 [liquid-glass.blend](./liquid-glass.blend) 内。

## 渲染

- [正面等距](./renders/front.png)展示高处的悬置透镜、半开放工坊和下层测试庭院。码头过去的石阶在中段分流，庭院台阶到达观测台，玻璃连廊跨过两栋建筑之间的坡地。
- [侧后方](./renders/rear.png)可检查岩壁闭合、连廊墩和斜撑、工坊后部的采光与排水，以及透镜背面的标定装置。
- [顶部](./renders/top.png)显示码头、工坊、标定附楼、观测平台和庭院之间的实际路径。
- [光学装置特写](./renders/objective.png)可见双凸镜片的曲面和约 0.34 Blender 单位的厚边、分段抱圈、偏心外轭、配重、耳轴、手轮和回转底座。后置明暗条板与连廊透过厚镜片弯曲。
- [工坊特写](./renders/workshop.png)展示窗格、立边屋顶与排风口、雨棚、工作台、准直仪，以及带金属夹座的庭院玻璃试件。

庭院用三种不同厚度和表面处理的实体试件表达 Clear、Soft 与 Prismatic。Clear 让后方标定条保持清晰，Soft 通过较高粗糙度柔化轮廓，Prismatic 依靠实体斜边改变入光角度。配色来自软件材质的透明度、柔和度和边缘高光。 [Liquid Glass 材质说明](https://github.com/librecosta/liquid-glass#optional-materials)

## 同尺度对照与验收

[对照图](./renders/comparison.png)包含折光屿、Harvest H2 源文件和正式 GLB，以及 Bay、Foundry 和原 Prism。各模型采用 WORKS 方位与约 23° 俯视角，较长的水平轴统一为 21 Blender 单位，共用正交相机尺度和灯光。折光屿的主体高度由透镜和轭架形成，屋面、窗格和桥体围合出连通空间，前景庭院提供对照材质，整体建筑密度与 Harvest 接近。

Blender 5.3 重新打开成品源文件，确认没有外部模型或贴图依赖。源文件保留 1,720 个可编辑岛屿对象、36,158 个未应用修改器的三角面、73 个材质和五台正交相机。复核基岩、透镜、玻璃试件和抱圈的闭合性与法线，对 37 级踏面采样确认没有穿入基岩。仓库 `pnpm check` 通过。

## 复现 L1

建模脚本复用仓库内 Harvest 的基础 Blender 几何工具。运行下列命令可将重建结果写入 `.local`，原始文件可独立打开。

```powershell
blender --background --factory-startup --python-exit-code 1 --python assets/works/liquid-glass/build.py -- --output .local/liquid-glass-l1/rebuild --renders front rear top objective workshop
blender --background --factory-startup --python-exit-code 1 --python assets/works/liquid-glass/compare.py -- .local/liquid-glass-l1/equal-scale .local/liquid-glass-l1/comparison.png
```

## L2 材质与 Web 验收

沿用 L1 的 1,720 个可编辑对象。重新打开 Blender 源文件，核对网格、变换、Collection 和倒角参数与 L1 一致。青铜抱圈、风化金属屋面、石材与木料共用两张 512 × 512 图集。软日照遮挡和接触 AO 写入不透明几何的顶点色。两张图集和一张主透镜厚度贴图均内嵌于 Blender 源文件。

透镜保留曲面与厚边，Clear、Soft、Prismatic 分别呈现清透、柔化和厚边折射。闭合玻璃采用 glTF PBR 透射、折射率与体积吸收，主透镜使用径向厚度贴图。多层光路由 Three.js 的屏幕空间透射近似，网页网格经画布 Alpha 合成。[glTF 体积材质规范](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_volume)

| Chrome 157，1440 × 900，DPR 1 | GLB 字节 | 模型三角面 | 每次重绘 Draw Calls |
| --- | ---: | ---: | ---: |
| 折光屿 L2 | 1,081,908 | 52,462 | 8 主画面 + 1 透射预通道 |
| Harvest H2 | 891,716 | 40,610 | 3 主画面 |

透射预通道额外提交 47,502 个不透明三角面，分辨率为画布的 75%。反射图在首次绘制时生成，静止时无连续 WebGL 绘制。在同一页面连续打开和退出五次，均销毁 WebGL 上下文并释放几何缓冲与纹理。轮盘首屏无 WebGL、GLB 或 Draco 请求，分别打开八个项目验证按需加载。关闭 WebGL 与阻断模型请求时均显示静态图和档案。

检查了 1920、1440、960、390、320 px 视口，移动端使用 Chrome 触屏模拟。桌面实看正面、背面、近景及复位，标定条、窗格、金属连接和工坊内的物件可辨。核对拖动、触摸缩放、键盘、前后翻阅及返回轮盘后的焦点。 `pnpm check` 通过。 [WORKS 实际截图](./renders/web-front.webp) · [正式 GLB](../../../public/works/islands/liquid-glass.glb) · [正式渲染器生成的 560 × 420 透明预览](../../../public/works/previews/liquid-glass.webp)

Blender 5.3 可从当前源文件复现同一个 GLB。由 L1 重新制作时，追加 `--blend` 和输出路径可保存材质深化后的源文件，追加 `--render` 可输出正交相机 PNG。

```powershell
blender --background assets/works/liquid-glass/liquid-glass.blend --python-exit-code 1 --python assets/works/liquid-glass/bake_web.py -- --glb public/works/islands/liquid-glass.glb
```
