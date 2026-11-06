# R1-C2 · Surface Character Samples

本轮只制作 **一块 L 形方环表面样板**。原 R1-B2 / R1-C 源工程、三环几何、旋转关节、内核与整套动画均未修改。没有把新纹理应用到正式观测核。

## Git 核实

2026-11-06 执行 `git fetch origin develop` 成功。远端仍为 **218e3dd（R1-B）**；本轮开始时本地为 **ff79571**，领先远端两个提交：

- **a93e7bd**：R1-B2 嵌套单轴结构。
- **ff79571**：R1-C 材质研究。

这两个提交此前**没有执行 push**，并非一次推送成功后远端未显示，也没有证据表明发生了网络推送失败。前两轮交付已写明“未推送”。本轮核实期间未重置、改写历史或丢弃修改；没有执行远端写入。

## R1-C 实际源工程审计

检查实际 `../r1-c/witness-core-materials.blend`、节点连接、材质槽、UV 和脚本，并执行了一次**临时未烘焙 GLB 导出**。完整事实见 [r1-c-audit.json](r1-c-audit.json)，可用 [audit_r1c.py](audit_r1c.py) 复验。

| 问题 | 实际结论 |
| --- | --- |
| 1. 两套金属是否创建 | 是。Outer Monument Metal 和 Inner Precision Metal 是两个独立 Principled 材质；另有 Core Light Material。 |
| 2. 分配位置 | Ring A/B/C 每环均有 104 个面使用 Outer、96 个面使用 Inner。Outer 覆盖主体／外表面，Inner 覆盖朝向方孔的内壁及相关倒角。Core 的 98 个面使用 Core Light。 |
| 3. Roughness 是否有纹理变化 | 是程序纹理，非仅常量。Outer：Object Noise(340) → ColorRamp(0.48–0.61) → Roughness；Inner：Object Wave(220) → ColorRamp(0.29–0.36) → Roughness。**没有 Roughness 位图或烘焙图。** |
| 4. Normal / Bump | Outer 有两级 Noise → Bump，Distance 0.0015 / 0.00025，Strength 0.22 / 0.17；Inner 有 Wave → Bump，Distance 0.00018、Strength 0.12。均为着色法线，未改变实体表面。 |
| 5. UV / 烘焙 / 雕刻 | 三个方环均无 UV；Core 只有立方体原始默认 UVMap。没有图像纹理节点、贴图烘焙、独立高模或高模雕刻。 |
| 6. Blender 专用效果 | Object Noise / Wave、ColorRamp 和 Bump 网络，以及 Cycles 间接光、摄影棚、AgX 与去噪。原材质中程序颜色、Roughness 与 Bump 不能自动等价变成网页纹理。 |
| 7. 实际 GLB 结果 | 临时 GLB 为 53,068 字节，**0 images / 0 textures**。有倒角实体、法线、材质分区、3 条动画及部分常量／扩展数据；没有程序化表面细节。Outer 程序底色也未导出为图像或对应颜色因子，不能据此宣称视觉一致。Core 的颜色、粗糙度、自发光、Transmission / IOR 数据与 Inner 的常量颜色／Anisotropy 数据可见于导出 JSON。 |

因此，R1-C 是**程序材质与光照研究**，不是已经完成 UV、烘焙与雕刻的最终纹理资产。

## 三个受控样板

[overview.png](previews/overview.png) 上排为中景，下排为近景；六张独立原图保留在 `previews/`。三个样板共享**同一个网格数据块、同一个 UV、同一位置**，每种景别使用完全相同的相机、五块摄影棚面光、曝光、种子和采样参数。没有为单个方案改灯或后期增锐。

| 方向 | 表面差异 | 尺度与深度参数 |
| --- | --- | --- |
| A · R1-C baseline | 原 R1-C 着色器；大面平整，微纹理在中景较弱。 | 原始 Noise / Wave / Bump 参数。 |
| B · Fine forged | 局部成簇的细浅锻坑、细粒起伏；坑内更粗糙偏暗，平整部位略有磨亮；内壁有细密方向加工纹。 | 名义单元间距约 1/22 = 0.045 BU；Bump Distance 0.0022、Strength 0.65。 |
| C · Stylized shallow tooling | 更宽疏的圆角方形锤击／浅凿痕，保留大片平面；尺寸更可读，适合进一步讨论动画化表面语言。 | 名义单元间距约 1/7.5 = 0.133 BU；Bump Distance 0.004、Strength 0.65。 |

BU 为 Blender 单位。梁截面 **0.72 × 0.72**、倒角 **0.012 / 3 段**沿用 Ring C 比例；物理世界尺度仍未冻结。上表是高度场的参数尺度，**不是实测雕刻深度**。凹凸通过法线表达，没有实体位移；轮廓保持完整。

新样板只在平整主体／内壁研究表面变化，倒角区域沿用基线材质烘焙，避免粗糙细节吞没精密亮边。微氧化用非均匀暗灰色与粗糙度共同表达，没有橙红重锈、掉漆或裂纹。

**C 的“雕刻感”是程序高度场模拟，不是手工高模雕刻。** 本轮没有制作高模；不将它包装为已完成雕刻制作。

## 本轮确实新增的纹理资产

B / C 样板均有一套新的 Smart UV atlas，已经实际烘焙 **2048² Base Color、Roughness、切线 Normal**，共六张 PNG，位于 `textures/`。Base Color 为 sRGB；Roughness 和 Normal 为 Non-Color。留边 16 px。正式样板渲染使用这些图像材质，非只展示程序节点或调整常量。

[texture-overview.png](previews/texture-overview.png) 排列实际烘焙图；[sample-verification.json](sample-verification.json) 记录图像尺寸、有效 UV 区间的数值变化、文件摘要与 GLB 验证。源程序材质保留于 Blender 工程，可通过脚本重建；当前观测核整体仍没有新增 UV 或贴图。

- [B 样板 GLB](exports/B-fine-forged.glb)
- [C 样板 GLB](exports/C-stylized-tooling.glb)

两个 GLB 均检查嵌入 Base Color、Metallic-Roughness、Normal 图像及 UV、法线、显式切线；重新导入后的顶点位置集合在 1e-5 量化精度下与样板一致，并实际重渲染查看。只在导出副本上固化材质分配和三角化，不修改共享样板或正式观测核。

## 结果与边界

中景已能读到 B 的细密局部锻痕与 C 的宽疏凿痕；近景可区分黑化主体和加工内壁。C 的痕迹仍偏柔和，是风格化方向样板；最终痕迹尺度、密度与氧化对比由用户选择后再收敛。**没有选定最终方向，也没有覆盖三个正式方环。**

渲染：本机 Steam Blender 5.2.3 LTS，RTX 3070 Laptop GPU / OptiX，1440×1080、96 samples、固定 AgX；全部为实际渲染与程序拼版。本轮没有重做内核、动画、概念图或官网。

## 重建

在仓库根目录执行，按本机路径调整 Blender。只使用新的独立后台进程，不操作正在打开的用户工程。

```powershell
$blenderExe = 'E:/SteamLibrary/steamapps/common/Blender/blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c2/audit_r1c.py
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c2/samples.py
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c2/verify_samples.py
python art/witness-core/r1-b/r1-c2/compose_overview.py
```

源工程为 [surface-samples.blend](surface-samples.blend)，参数为 [sample-parameters.json](sample-parameters.json)。Blender 自带组件完成建模与烘焙；拼版只需已有 Python + Pillow。临时审计 GLB、试渲染及 GLB 回读画面留在系统临时目录。未提交缓存、自动备份或无用高分辨率中间帧。
