# 程序化环境研究 · P1-A

2026-11-06。目标是先确认荒原的空间灰模；以下是技术取舍，不冻结世界观、建筑母题或最终镜头。没有引入 Houdini 运行时，也未下载第三方设计资产。

## 研究与取舍

| 主题 | 技术思想与优缺点 | LibreCosta 的采用方式 |
| --- | --- | --- |
| 人工 Massing | 先控制山体占地、高低关系与围合空间，再增加细节，比全域叠噪声更容易保持构图；需要明确的人工空间决策。 | 少量椭圆地貌体控制两侧与远方；中轴通行遮罩降低起伏，建筑群落地遮罩保证基座稳定。 |
| Heightfield 与多尺度噪声 | 二维网格保存高度，便于分层与重采样；不能表示悬挑、洞穴和同一平面坐标上的多层地表。细节尺度过小而振幅过大容易产生尖峰。 | CPU 上生成确定性高度，转换为真实索引网格并重算顶点法线。大尺度形体优先，三层低振幅平滑值噪声只补自然变化，不做侵蚀模拟。 |
| 局部生成遮罩 | 遮罩限制某层效果的作用范围，便于分开调整道路、盆地和山脊；遮罩过硬会产生突兀台地。 | 平滑通道遮罩保留少量大尺度起伏；移除平整建筑基座遮罩，让人工沙丘包裹构件。禁止噪声改变主要负空间。 |
| 程序化与模块化 | 先定义构件与空间规则，再重复组合；可迭代、可复现，缺点是容易显得等距机械或像随机城市。 | P1-A2 已移除行列填充。8 个构件的位置、宽厚比、倾角和埋深全部人工指定，共同语言来自几何与比例；程序只生成地形及变换。 |
| InstancedMesh | 同几何、同材质的不同变换可合并提交；不能自动解决材质多样性、实例级剔除或过大批次包围范围的问题。 | 7 个完整长方体共享几何，另有 1 个台形；不同 Quaternion 与尺度不需要复制网格。写完矩阵后更新属性与包围体；当前无需空间分块平台。 |
| 空气、光与几何 | 雾降低远处对比，日光显露体量；过浓的雾或过强环境光会掩盖构图缺陷。 | 用基础 DirectionalLight、HemisphereLight、阴影与线性 Fog；近处保持清楚，远方融入同色天空。不加 Bloom、粒子或体积云。 |
| 离线／实时边界 | 离线适合独特结构和复杂静态细节，实时适合参数布局与响应视口；烘焙材质不等于可直接迁移整套离线光照。 | 本轮全部是基础几何和灰模材质；Blender 留待重要独特资产与必要烘焙，整体构图通过前不做高模与精细纹理。 |

地形的分层、遮罩与限制来自 [SideFX Heightfields](https://www.sidefx.com/docs/houdini/heightfields/)，先 Massing 后细节与逐步重采样的思路来自 [Terrain Creation](https://www.sidefx.com/docs/houdini/heightfields/creation.html)。我们采用其制作逻辑，不复制 Houdini 的噪声或侵蚀实现。

实例化的 API、矩阵更新与包围体职责以 [Three.js InstancedMesh 文档](https://threejs.org/docs/pages/InstancedMesh.html) 为准。Crosswire 文章讨论的是 2023 年的实现限制，不能据此断言当前 Three.js 完全不支持实例网格包围体剔除。

## 案例参考

- [Three.js Terrain + Fog](https://threejs.org/examples/webgl_geometry_terrain.html) 及其 [r187 源码](https://github.com/mrdoob/three.js/blob/r187/examples/webgl_geometry_terrain.html)：展示高度生成、地形几何与雾组合的基础路径。本项目只借鉴职责划分，不复用其纹理生成或自由移动操作。
- [Unseen Studio：Crosswire](https://tympanus.net/codrops/2023/04/04/case-study-crosswire/)：作者将品牌构件组织为三维网格，离线导出布局信息，再实例化重复模型；为匹配画面，曾以多张 Matcap 替代昂贵反射。本项目借鉴“布局数据与重复构件分离”，不采用其金属美术、扫描波和拖尾。文章直连曾返回 403，正文通过检索索引读取。
- [Animorio：Hubtown 逆向参考](https://animorio.com/en/journal/hubtown-how-its-made/)：属于第三方逆向分析，不是原作者制作说明。文中声称地形来自 Houdini 高度图，并结合压缩纹理、glTF 与镜头编排。**这些实现细节未独立核实**；仅作为未来离线高度场与实时布局分工的研究线索，不照搬蓝色夜景、发光体、水面、加载仪式或滚动系统。
- [R3F Scaling Performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)：采用按需渲染。P1-A2 由 GSAP ScrollTrigger 更新进度并请求渲染，`useFrame` 是唯一相机写入者；空闲后停止请求帧，页面隐藏时暂停渲染。没有两套系统同时平滑相机属性。

## 当前实现与待验证事项

- 参数源：`src/components/expanse/parameters.ts`；地形、埋藏与路径算法：同目录 `world.ts`。固定种子只控制地貌细节，所有巨构布局人工配置。
- 只有 `/lab/expanse` 初始化一个客户端 Canvas，正式首页维持原状；HTML 标题、观察点与空间说明先于 WebGL 存在。没有外部模型、纹理或天空资产请求。
- 移动端使用较低地形网格密度、DPR 上限和更宽视角，共用经过净空检查的三维路径，几何高度函数与布局一致。桌面模拟移动视口不等于真实手机性能或触摸手势验证。
- **待验证／后续范围**：真实手机 GPU、触控板／触摸硬件和功耗；更复杂地形下的分块与 LOD；最终高速镜头；需要更复杂大气时的成本。本轮仅验证现有受控路径。

本轮浏览器观察与仍存构图问题记录于 [expanse-blockout.md](expanse-blockout.md)。后续按 **地形 → 巨构布局 → 镜头构图 → 空气与光线 → 正式材质** 迭代。
