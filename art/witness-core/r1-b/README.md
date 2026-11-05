# Witness Core · R1-B2

厚构件灰模与层级单轴运动，替换 R1-B 的平级自由旋转方案。旧方案为任意姿态避碰让出了过大空隙，导致纤细、松散；本轮按厚重嵌套的视觉目标重新定比例。旧版本保留在 Git 提交 `218e3dd`，不保留重复工程。

使用本机 Steam **Blender 5.2.3 LTS** 独立后台进程。MCP 未连接，未升级、重装或操作用户打开的文件。只有简单灰色环体与白色内核，无正式材质、纹理、发光后处理或网页改动。

## 比例与层级

单位为 Blender 单位，物理尺度仍未冻结。环面为局部 XZ，法线厚度 D 沿局部 Y，所有关节与内核共心；单位缩放、无平移。每个环为一个真正闭合的实体网格，不拼接重叠方柱。

| 组件 | 外边长 S | 梁宽 W | 法线厚度 D | 相对父层的轴与范围 |
| --- | ---: | ---: | ---: | --- |
| A · 内环 | 1.94 | 0.40 | 0.46 | Y 主法线，±6° |
| B · 中环 | 3.15 | 0.50 | 0.56 | A 左右对边中点连线 X，±40° |
| C · 外环 | 4.80 | 0.72 | 0.72 | B 上下对边中点连线 Z，±30° |
| Core | 0.60 | — | — | 根节点下稳定不转 |

环体统一倒角 0.012 / 3 段；内核倒角 0.006。与 R1-B 相比，外 / 中 / 内环梁宽由 0.45 / 0.30 / 0.16 增至 0.72 / 0.50 / 0.40，厚度由 0.35 / 0.25 / 0.14 增至 0.72 / 0.56 / 0.46。对齐姿态下 C–B、B–A 的单侧名义间隙均为 **0.105**，原先分别为 0.700、0.375。

层级为 `WitnessCore → RingAPivot → RingBPivot → RingCPivot`；各 Ring 网格归属自己的 Pivot；Core 直接归属 WitnessCore。外层继承内层姿态后，才施加自己的单轴转角。三个独立 Quaternion Action，不使用平级世界轴自由旋转或可见铰链零件。

## 运动与验证

- **Idle，帧 1–241**：小幅、不同相位的单轴校准运动，首尾各 1 秒平滑启停。A 振幅 4°、B 28°、C 22°，均在允许区间内；不是全周陀螺运动，也不是循环片段。
- **Precision Alignment，帧 241–481**：各关节从 Idle 终态按五次 smootherstep 回到 0°；用标量关节角构造局部 Quaternion，不以世界姿态 slerp 绕开单轴限制。内核始终稳定；任意时间可重复、可倒放。
- **限定角域的连续几何保证**：只覆盖上表串联轴与角度组合。将内层包围盒投影到外层已验证的空方孔棱柱；采用 `h=S/2-W-bevel_width`，含倒角余量。相邻层投影极值包含区间端点和 `atan(D/S)` 临界角，非相邻层另行保守约束。实际三角面检查空孔、外包尺寸、闭合流形与自交。全域最小间隙下界 **0.0661008 > 0.05**，已经扣除数值余量；这是保守下界，**不是精确最近表面距离**。
- **独立实际网格采样**：时间线 961 姿态（每 0.5 帧）、完整关节区间网格 1,105 姿态及中等偏转截图姿态 1 个，共 **2,067 × 6 对**；正确应用父子世界变换后，BVH 表面相交及实体包含均为 0。包含检测用有向立体角绕数，附相交、包含、分离盒与不安全尺寸的正反例检查。61 个时间点倒序复查，结果一致。
- 采样本身不是连续运动证明；连续保证来自限定轴与角域的棱柱投影约束。**任意自由旋转、角域外、轴向 / 层级 / 尺寸 / 网格改动均未验证，必须重建重验**。详见 [collision-report.json](collision-report.json)。

源文件已在独立进程中重新打开并验证。四个网格共 **672 顶点 / 1,340 三角面**，均可编辑、单一连通、闭合、正体积。另一次独立重建的网格与动画关键帧摘要一致。

## 预览与重建

[overview.png](previews/overview.png) 包含重点静止三分之四、对齐正面、嵌套斜侧、中等偏转、侧面、顶面、Idle 中段与对齐终点。中等偏转采用 A +2° / B +28° / C −22°，不改写主时间线。

[Idle MP4](previews/idle-rotation.mp4) 为 10 秒；[Alignment MP4](previews/precision-alignment.mp4) 为 10.042 秒。均为 Workbench 灰模、H.264、1280 × 960、24 fps、无声音。逐帧核对完整画幅，并实际查看静帧及编码后视频的多个解码时刻；见 [manifest.json](previews/manifest.json)。不把灰模光照当正式材质。当前可继续评审这份基线，最终厚重程度、默认停留姿态与校准幅度仍由用户选定。

在仓库根目录运行；按本机安装修改可执行文件路径：

```powershell
$blenderExe = 'E:/SteamLibrary/steamapps/common/Blender/blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/build.py -- --previews
& $blenderExe --background art/witness-core/r1-b/witness-core.blend --python-exit-code 1 --python art/witness-core/r1-b/validate.py
python art/witness-core/r1-b/compose_previews.py
```

[parameters.json](parameters.json) 是尺寸、轴、运动范围、函数参数与预览配置的来源。建模 / 验证 / 视频仅使用 Blender 自带组件；拼版需要系统 Python + Pillow。构建器只接受新的 `--background --factory-startup` 进程，不替换打开的用户工程。交付不含缓存、备份或视频逐帧中间图。
