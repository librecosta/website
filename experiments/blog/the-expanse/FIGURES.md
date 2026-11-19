# F01–F10 配图索引

本机交付批次为 [`e1`](outputs/e1/manifest.json)，整理后的十图见 [预览索引](outputs/publish/index.jpg)。所有图共用 1600 × 900 的输出尺寸。浏览器原图、相机姿态、光学配置、当前几何指纹及对照开关均在 `outputs/e1/raw/`。拍摄条件与限制见 [REPORT.md](REPORT.md)。

下表中的 `N` 表示 `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/numeric.mjs`，`B` 表示 `node scripts/browser.mjs`，`P` 表示 `python scripts/figures.py`，均从实验目录执行。复现时用自己的批次名替代 `e1`。

| 图 | 图注及出处 | 复现 | 原始输入 |
| --- | --- | --- | --- |
| [F01](outputs/publish/F01-heightfield-decomposition.png) | 谷底基底与完整沙丘几何用绝对高度；其余四幅为高度贡献。六图共用网格、世界范围和色标，色标会压缩小幅噪声的视觉差异。此处为局部遗迹积沙修改前的高度。 | `N e1 F01` → `P e1 F01` | `F01-height.json` |
| [F02](outputs/publish/F02-terrain-geometry.png) | 同一机位的索引网格叠加与着色结果。线框直接引用正式的桌面地形索引及顶点，原深度遮挡保留。 | `B e1 F02` → `P e1 F02` | `F02/{mesh,final}.{png,json}` |
| [F03](outputs/publish/F03-aeolian-surface-shader.png) | 无细节扰动、宽纹、细纹、正式组合。使用同一近地矩形区域，保留原始 RGB，无对比度增强。 | `B e1 F03` → `P e1 F03` | `F03/{smooth,broad,fine,complete}.{png,json}` |
| [F04](outputs/publish/F04-shader-antialiasing.png) | 同一远斜视沙面像素区域对比导数滤波开关，距离淡出保持。单张静帧差异有限，不能据此判断运动摩尔纹。 | `B e1 F04` → `P e1 F04` | `F04/{filtered,unfiltered}.{png,json}` |
| [F05](outputs/publish/F05-sand-concentration-field.png) | 2 s 时浏览器内 `SandDust` 使用的列质量数组，配同机位合成画面与浓度调试层。单位 mg/m²，数值出自模型。 | `N e1 F05` → `B e1 F05` → `P e1 F05` | `F05/{transport,density}.{png,json}`、`F05-offline.json` |
| [F06](outputs/publish/F06-moving-transport-window.png) | 相同模拟时刻移动一个步幅。展示全局域、前后窗口、保存的重叠区、未活动区、名义平流方向及质量账。 | `N e1 F06` → `P e1 F06` | `F06-window.json` |
| [F07](outputs/publish/F07-sandstorm-rendering.png) | 仅从输出移除 `scatterSandstorm()` 的近景散射；地表输沙、沙粒及相关消光仍参与渲染。 | `B e1 F07` → `P e1 F07` | `F07/{veil-off,veil-on}.{png,json}` |
| [F08](outputs/publish/F08-procedural-sky-layers.png) | 正式天空四调试状态。最终画面含区域天际云，四个状态的无云空气透视半幅一致。 | `N e1 F08` → `B e1 F08` → `P e1 F08` | `F08/{background,main,secondary,color}.{png,json}`、`F08-sky.json`、`F08-field.rgba` |
| [F09](outputs/publish/F09-aerial-perspective.png) | 相同视角和光照下移除或保留材质的距离雾混合。天空、城区区域云与直接光保持，观察远处碑林和城市的反差。 | `B e1 F09` → `P e1 F09` | `F09/{mix-off,mix-on}.{png,json}` |
| [F10](outputs/publish/F10-runtime-performance.png) | 同一台笔记本 GPU 上两套视口配置的实测分布。帧间隔是提交事件间距；GPU 耗时来自定时扩展。 | `B e1 F10` → `P e1 F10` | `F10-frames.json`、`browser.json` |
