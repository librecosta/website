# WORLD 第一幕源码证据

实验读取 `2e710906e974c09777f3c7279744bbcada5404c9`。链接指向仓库中的生产实现；配图与原始证据索引见 [FIGURES.md](FIGURES.md)。下文的 wu 是场景世界单位。仅输运模块采用 0.08 m/wu 的标定，其余尺度按各自的场景参数解释。

## 高度场与沙丘几何 · F01、F02

[`world.ts`](../../../src/components/expanse/world.ts) 的 `valleyAt()` 对谷地中轴、谷底高度和宽度逐段平滑插值；`heightAt()` 叠加不对称谷岸、`crestAt()` 定义的连续坡脊、旋转并弯曲的横风隆起及多频值噪声。相邻连续坡脊使用 `mergeCrests()` 的平滑最大值融合，走廊遮罩压低丘体与细噪声。F01 对每组保留自身的完整公式，通过原函数参数隔离取相对谷底的差值，避免把组内的非线性直接拆成可相加的单脊。

`duneRelief()` 根据风向和每条丘脊的偏角构造迎风长缓坡及背风短坡，圆化丘脊与坡脚并乘走廊遮罩和固定噪声。`buildAeolianTerrain()` 将此项写回实际 Float32 顶点 Y，改变剪影与三角面。种子 7137、X = ±3,600 wu、Z ≈ −12,800…−457.143 wu。桌面 280×480 网格单元、281×481 顶点、268,800 三角面；窄屏 144×256 单元、73,728 三角面。每格固定对角线。[`ExpanseCanvas.tsx`](../../../src/components/expanse/ExpanseCanvas.tsx) 的 `World()` 追加局部遗迹积沙后给 `indexedGeometry()`，地形法线由索引面的 Three.js `computeVertexNormals()` 产生。F01 是积沙前的绝对高度，F02 对应积沙后的实际几何与遮挡。变化来自预制参数化构图，运行时风沙保留这套地形顶点。

## 沙纹与屏幕空间滤波 · F03、F04

[`aeolian-material.ts`](../../../src/components/expanse/aeolian-material.ts) 的 `createAeolianMaterial()` 在 `MeshStandardMaterial.onBeforeCompile` 取世界 XZ、投影到沿风和横风坐标，并用连续的相位弯折、风向沙床及表面坡向调节宽纹与细纹。沙面梯度扰动着色法线，沙床也改变粗糙度和底色。宽、细两频波长 8.6 / 3.75 wu，梯度幅值对应 0.056 / 0.024 wu 微高度；距离淡出区间分别 300–820 和 125–340 wu。F03 隔离扰动层时保留共同的相位、覆盖与坡向项，宽纹或细纹组关闭另一路以及床面独立浮雕、粗糙度和染色。所有组仍有地形网格本身的几何法线。

`duneFootprint()` 用 `dFdx/dFdy` 估计相位在像素上的变化，`duneFilter()` 在 ≈0.11–0.32 cycles/pixel 抑制细节，床面也有独立足迹衰减。F04 只绕过这两处足迹衰减，保留距离淡出和光照。示例静帧可确认着色响应发生变化；结果不足以证明实际滚动中能看到明显的抗摩尔纹改善。

## 浓度、质量与窗口 · F05、F06

[`sand-transport.ts`](../../../src/components/expanse/sand-transport.ts) 的 `createSandTransport()` 在 XZ 列网格用迎风面通量与显式扩散更新列质量，依地形、障碍上风遮蔽、阵风剪切和床沙供应改变起沙，按指数系数沉降。静态地形高度来自 `renderedGround()` 的真实三角面插值，遮挡用 `windSurfaceAbove()`，床沙供应由 `sandBedSupply()` 根据世界坐标和坡度估计。全域 112×480，活动窗 112×172，X = [−625,625]，Z = [−5600,−500] wu。每步 1/32 s，扩散 0.15 m²/s，基础沉降 0.39 s⁻¹，盐跃阈值约 0.2232 m/s 摩擦速度。列质量为 mg/m²，面积乘积才是质量账的 mg。此处系数用于场景，未用真实环境观测校准。

`follow()` 从相机 Z 向前定位，提前量 1510 wu，以 4 行、42.5 wu 为步幅。内部固体边界无穿越通量。外侧和窗口边缘按流向允许入流与流出；新行使用上游与停留时间近似，保留的活动行不重算；再次进入的非活动行按经过时间补沉降。F06 在相同模拟时刻移动一个步幅，证明重叠区域浓度连续。首次进入行的估计初始化会把床沙转入空气，所以总体扬尘质量与累计 lifted 项都可能随 `follow()` 改变。

[`SandDust.tsx`](../../../src/components/expanse/SandDust.tsx) 用 96 mg/m² 的上限和平方根编码上传 R8 纹理，并让接地细层按列质量分摊显影。三个生产层的高度约 0.11、0.33、0.70 m，质量比例 0.43、0.34、0.23。F05 的图 A 直接读取生产浏览器模拟用的浮点列质量；图 C 为现有浓度模式，显示单层并关闭近景散射，方便检查传播位置。二维输运没有解算三维速度或密度，也没有把沉积写回沙丘几何。

## 近景沙暴与沙粒 · F07

[`sandstorm.ts`](../../../src/components/expanse/sandstorm.ts) 的 `cameraStorm()` 使用按风向平移的固定种子三维噪声和分段近景积分，表面深度截断射线。桌面 5、移动配置 4 个近景采样；消光 0.0115 wu⁻¹，89–175 wu 淡出，主要相位速度 218 wu/s。以指数透射积累色光再由 `scatterSandstorm()` 混入底色。这个可控近似与二维浓度场是两个系统。`SandDust` 共享曝光控制；[`StormGrit.tsx`](../../../src/components/expanse/StormGrit.tsx) 用由种子产生的点属性渲染 5,200 / 1,500 个局部沙粒，其消光仍可读取 `cameraStorm()`。F07 只隔离 `scatterSandstorm()` 的合成结果，保留相同风向、透明层和粒子路径；没有直接量化单个沙粒的贡献或计算完整体积流体状态。

## 天空色表与空气透视 · F08、F09

[`atmosphere.ts`](../../../src/components/expanse/atmosphere.ts) 的 `createAtmosphere()` 用含 Rayleigh/Mie 项的日光解析近似，按仰角及太阳夹角预计算 96×64 色表，再投影到 512×256 世界方向。[`sky-field.ts`](../../../src/components/expanse/sky-field.ts) 的 `createSkyField()` 以连续笛卡尔噪声生成底场，以倾斜球面流向坐标、周期经度与多尺度纤维生成主云带和分支。云带通过 `bakeSkyRadiance()` 的指数不透明度加入天光，带有明确的色彩编排。512×512 RGBA16F 纹理上下存放可见天空与无云空气光；U 周期采样。[`AtmosphericSky.tsx`](../../../src/components/expanse/AtmosphericSky.tsx) 用单个全屏三角形读取方向色表，并在 `color` 叠加区域天际云。F08 的 `background` 已含底场与光色分级；空气光半幅在所有天空调试模式下保持一致。这是解析色表与场景构图，未进行多重散射、大气动态或实际气象模拟。

`applyAerialPerspective()` 在显示传递函数前按距离与高度条件将着色后的表面颜色混入同方向的空气辐射。普通雾范围 1,750–12,900 wu，远碑 15,700–40,800 wu 按 0.30–0.94 混合，城市 51,000–255,000 wu 并额外考虑低处与云区。F09 仅移除该 RGB 混合，保留曝光、太阳、天空和独立的城区云处理。此实验演示深度可读性，未把色表雾解释为密度场定量结果。

## 相机与渲染调度 · F02–F10

[`ExpanseExperience.tsx`](../../../src/components/expanse/ExpanseExperience.tsx) 收集原生滚动与视口状态，[`ExpanseCanvas.tsx`](../../../src/components/expanse/ExpanseCanvas.tsx) 的 `Observation()` 统一更新相机。实验输入 `position` 是映射前的正常滚动信号，经正式 `mapJourneyProgress()`、`sampleJourney()`、`fitVerticalFov()` 和取景计算。截图核对实际位置、四元数、垂直视角和地形指纹。可见画布使用 R3F demand 调度，活动时按绝对截止时间使其失效绘制，桌面 60、移动配置 30 次/秒目标，隐藏时停止定时请求。F10 固定滚动信号并保留运行中的城市、沙粒和输运，独立统计渲染提交和 GPU 查询结果。采样窗口与限制见 [REPORT.md](REPORT.md)。

[`scripts/check-expanse.mjs`](../../../scripts/check-expanse.mjs) 的现行检查覆盖地形确定性、结构保守净空、镜头路径离散采样、CFL 上界、窗移动及质量平衡。旧 [程序化环境研究](../../../docs/research/procedural-environments.md) 记录了此前的远场输运和早期天光基准，本文用本次源文件与样本取代这些历史数据来描述当前版本。
