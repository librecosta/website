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

## 复现与 L2

建模脚本复用仓库内 Harvest 的基础 Blender 几何工具。运行下列命令可将重建结果写入 `.local`，原始文件可独立打开。

```powershell
blender --background --factory-startup --python-exit-code 1 --python assets/works/liquid-glass/build.py -- --output .local/liquid-glass-l1/rebuild --renders front rear top objective workshop
blender --background --factory-startup --python-exit-code 1 --python assets/works/liquid-glass/compare.py -- .local/liquid-glass-l1/equal-scale .local/liquid-glass-l1/comparison.png
```

后续材质深化可集中在青铜抱圈的磨损和石材接缝。网页阶段需整理 UV，烘焙遮蔽与柔和日照，并验证不同视角的透明排序、粗糙度及厚玻璃边缘。正式 GLB 与轮盘预览在网页阶段处理。
