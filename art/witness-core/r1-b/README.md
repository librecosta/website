# Witness Core · R1-B

参数化灰模、两个确定性动作与碰撞验证。使用现有 Steam **Blender 5.2.3 LTS** 的独立后台进程完成；MCP 当时未连接，未修改安装或用户工程。无正式材质、纹理、Shader、AI 概念图或网页实现。

## 几何与结论

尺寸沿用用户基线，单位为 Blender 单位，不冻结世界中的物理尺度。环体处于局部 XZ 平面，法线厚度沿 Y；共同中心为原点，所有对象缩放为 1。

| 组件 | 外边长 S | 梁宽 W | 法线厚度 D |
| --- | ---: | ---: | ---: |
| Outer | 4.80 | 0.45 | 0.35 |
| Middle | 2.50 | 0.30 | 0.25 |
| Inner | 1.15 | 0.16 | 0.14 |
| Core | 0.38 | — | — |

每个环由一个闭合方形截面环体网格生成，不使用四根重叠方柱。统一 0.012 倒角、3 段；内核倒角 0.006。最终共 **672 顶点 / 1,340 三角面**，四个网格均为单一连通、正体积、闭合流形；无非相邻自交。层级为 `WitnessCore → 各自 RingPivot → Ring`，内核直接归属根对象。

**全角度数学保证**：`r_min=S/2-W`，`R_max=sqrt(2*(S/2)^2+(D/2)^2)`；内核 `R_max=sqrt(3)*0.38/2`。反三角不等式给出任意材料点间距下界 `r_min(outer)-R_max(inner)`，旋转保持半径。已核对倒角后实际三角面及顶点仍在计算包络内。

相邻层保守间隙依次为 **0.177819 / 0.133820 / 0.085910**；计入数值容差余量后最小下界 **0.085908 > 0.05**。保证范围为共心、无平移、无缩放、无形变的任意刚性旋转，独立于动画路径。

**实际网格采样**：帧 1–481，间隔 0.5 帧，共 **961 姿态 × 6 对对象**；世界变换后的 BVH 三角面相交与实体包含检测均为 0。包含检测使用有向立体角绕数，另有相交盒、完全包含盒、分离盒与不安全尺寸的正反例检查。采样不是连续安全证明；连续安全来自前述数学约束。详见 [collision-report.json](collision-report.json)。

已在新的 Blender 进程中重新打开源文件验证可编辑性、动画与倒放确定性；两次独立重建的四个网格及全部 Quaternion 关键帧摘要一致。改动尺寸、中心、缩放或网格后必须重建、重验。

## 动作与预览

- **Idle Rotation，帧 1–241**：三个不同世界轴、7 / −11 / 17 度每秒的中段角速度；前后各 1 秒使用五次速度缓入缓出。轴向在参数中定义并归一化，初始 XYZ 倾角仅用于构造 Quaternion，不作 Euler 动画插值。内核稳定。
- **Precision Alignment，帧 241–481**：从 Idle 终态以最短弧 Quaternion slerp 与五次 smootherstep 对齐至共同 XZ 平面。每帧烘焙为独立 Quaternion Action，不依赖运行脚本、刚体或外部模拟；可任意拖动及倒放。两段为非循环预演。
- [三视图与姿态对照](previews/overview.png)：正面、侧面、顶面采用同一帧 1；另有对齐正面、三分之四和三个时间姿态。全部为实际 Workbench 灰模渲染。
- [Idle MP4](previews/idle-rotation.mp4)：10 秒；[Alignment MP4](previews/precision-alignment.mp4)：10.042 秒。均为 H.264、1280 × 960、24 fps，无声音；使用 Blender 内置编码器。逐帧检查模型在画幅内，并对编码后首、中、尾帧解码查看。输出信息见 [manifest.json](previews/manifest.json)。

现阶段不需要额外造型决策即可使用这份基线灰模；它的层间比例比概念图更疏朗，以满足任意相对转动的安全条件。若之后希望贴近概念图收紧比例，需重新验证，或明确改为受限运动方案，不以本报告自动背书。

## 重建

在仓库根目录运行；替换为自己的 Blender 路径。`build.py` 只允许新建后台进程，不接受已打开的工程；会更新本目录的生成物，不触及其他工程。

```powershell
$blenderExe = 'E:/SteamLibrary/steamapps/common/Blender/blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/build.py -- --previews
& $blenderExe --background art/witness-core/r1-b/witness-core.blend --python-exit-code 1 --python art/witness-core/r1-b/validate.py
python art/witness-core/r1-b/compose_previews.py
```

[parameters.json](parameters.json) 是尺寸、初始姿态、轴向、运动和预览配置的来源；`build.py` / `kinematics.py` 建模与烘焙，`validate.py` 独立检查实际源文件，`render_previews.py` 导出画面。只有最后的拼版需要系统 Python + Pillow；建模、网格验证与 MP4 均只用 Blender 自带组件。未提交缓存、自动备份或逐帧渲染中间资源。
