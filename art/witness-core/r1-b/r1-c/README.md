# Witness Core · R1-C

黑化锻铁、精密内壁与象牙白内核的材质研究。基于 R1-B2；**不改变任何顶点、拓扑、梁体厚度、倒角宽度、串联层级或动画关键帧**。只调整角点法线：大平面保持平面法线，现有倒角使用平滑加权法线。原灰模工程保留在上一级。

## 材质与表面语言

全部颜色数值为 scene-linear RGB；完整数值、程序纹理尺度与灯光见 [material-parameters.json](material-parameters.json)。三个环共用两种金属，每个环仅将朝向方孔的内壁及相关倒角分配为 Precision；没有新增装饰件。

| 材质 | Base Color 倾向 | Roughness | Metallic | Normal / Bump | Emissive |
| --- | --- | --- | ---: | --- | --- |
| Outer Monument Metal | 石墨黑，RGB 约 0.045–0.059 | 0.48–0.61 | 0.93 | 38 / 340 两级对象空间 Noise；低强度锻造与细粒起伏 | 0 |
| Inner Precision Metal | 略亮冷灰，RGB 0.105 / 0.113 / 0.119 | 0.29–0.36 | 1.0 | 沿局部 Y 深度方向的极细 Wave；微弱加工线，anisotropy 0.18 | 0 |
| Core Light Material | 中性略暖象牙白 | 0.26 | 0 | 无破损或颗粒；IOR 1.46、Transmission 0.08 | 象牙白，强度 0.7 |

年代感只用低对比、无彩色锈斑的色差和微粗糙度暗示微氧化；低幅法线模拟致密锻造表面。没有掉漆、裂缝、腐蚀坑或大面积磨白。内角积暗来自遮挡与路径追踪，不叠加一层黑色 AO 污渍。程序纹理使用物体局部坐标，随环运动，不在世界中滑动。

倒角沿用 **0.012 / 3 段**，Core 沿用 **0.006**。本轮不以加大倒角制造虚假的宽亮边。特写用于核对连续高光与微纹理；静止主视图优先保持沉稳的大体量。

## 内核与光照

内核用单一 Principled 介电表面及克制自发光；Cycles 直接计算发光网格对内壁的照明。**没有内核辅助灯、Bloom、Glare 或后期光晕**。五块外部摄影棚面光、暗灰地面与固定 AgX 曝光用于展示反射；并非第一幕场景。

[发光开关对照](previews/core-light-comparison.png) 仅关闭 Core emission，保持灯光、材质其余参数、相机、采样种子与曝光一致，可见近处内壁的微弱提亮。核心仍有三个可分辨的面与明确轮廓，光不吞没环体。强度为本次相对材质研究参数，尚未作真实世界光度标定。

## 预览与复核

- [总览](previews/overview.png)：原 R1-B2 Workbench 灰模、主视图、正面对齐、两张材质特写和内核受光关系。原灰模的灯光不同，另附 [相同 Cycles 摄影棚下的灰模 / 材质对照](previews/matched-comparison.png)。
- `previews/hero.png` 与 `aligned-front.png` 为 1536²；两张特写及内核开关对照原图为 1600×1200。全部由实际 Blender 工程渲染，未重绘或后期修饰。
- [Idle 材质预演](previews/idle-material.mp4)：原时间线帧 1–240，10 秒、24 fps、960²、H.264、无音轨。Cycles / OptiX、32 samples、OptiX 去噪；静帧为 128 samples / OpenImageDenoise。离线预演不代表网页帧率。
- 环境：Steam Blender 5.2.3 LTS；NVIDIA RTX 3070 Laptop GPU，8 GB。MCP 未连接，使用独立后台进程；未修改安装、全局偏好或打开的用户工程。
- [preservation-report.json](preservation-report.json) 对比实际打开的两个工程，确认几何、父子关系、局部变换、全部 Quaternion 关键帧及多个世界姿态一致；[collision-report.json](collision-report.json) 在材质源文件上重新运行 R1-B2 的 2,067 姿态和受限角域验证，保守间隙仍 ≥ **0.0661008**。法线 Bump 不产生实体位移。
- 平面角点法线采用 0.25° 方向容差，报告保存实际误差；逐帧检查全部 240 帧的物体包围范围，另解码查看约 0 / 2 / 4 / 6 / 8 / 10 秒六个时刻。未把静帧去噪结果当作网页实时性能。

## 未来网页转换

可以直接继承：几何倒角、角点法线、材质分区、Base Color / Metallic / Roughness 倾向、克制的 Emissive 颜色与强度设计。

需要后续整理：当前对象空间 Noise / Wave 应在确定 UV 与纹素密度后烘焙为 Base Color、Roughness、切线 Normal；加工方向各向异性需网页端相应材质支持。本轮**没有生成或假称已完成网页贴图与 GLB 材质导出**。

仅属 Blender 预演：多次反弹 GI、面光反射环境、去噪、摄影棚地面与 AgX 显示处理。网页端 emissive 本身不等于照亮周围金属，应另行选用受控近场灯或烘焙方案；不假设 Blender 节点或 Cycles 光照自动随模型迁移。

## 重建

在仓库根目录，使用现有本机 Blender；建模与渲染不需额外 Python 包，程序拼版只需系统 Python + Pillow。

```powershell
$blenderExe = 'E:/SteamLibrary/steamapps/common/Blender/blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c/study.py -- --video
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c/validate_materials.py
python art/witness-core/r1-b/r1-c/compose_overview.py
```

源文件为 [witness-core-materials.blend](witness-core-materials.blend)。建材脚本只允许新的后台进程，读取上一级源工程后另存此文件。已有匹配静帧时可使用 `--render-only --video-only` 重新导出预演；使用 `--render-only --shot clay-control` 可单独重做一张静帧；这两种模式应在命令中打开本材质工程。所有中间试图、日志和解码帧留在系统临时目录，不提交缓存或自动备份。
