# 风标岭 · The Vigil Station

WEB-V0.1-W4-U1。风标守望站沿不规则海岸抬升，由码头、监测与维护区、八角守望塔三层组成。从登岛码头沿挡墙旁的石阶上行，经有顶连廊抵达控制室和设备间，再沿山脊阶梯到达塔门。背侧保留检修步道、排水口和工作平台。

## 产品研究

对照 LibreCosta Uptime 的 `master` 源码和仪表盘。轻量自托管的 HTTP/HTTPS 探测对应尺度克制的工作站，历史记录对应控制室的记录桌和抽屉柜，故障与恢复通报对应塔顶的琥珀灯。岛上用一处连贯的工作场所表达监测、记录和维护。 [项目说明](https://github.com/librecosta/uptime/blob/5e83d8cde4aa00a16013d32fa463a2421a63c742/README.md) · [实际仪表盘](https://github.com/librecosta/uptime/blob/5e83d8cde4aa00a16013d32fa463a2421a63c742/docs/assets/uptime-dashboard.webp) · [v0.2.1 发布说明](https://github.com/librecosta/uptime/blob/5e83d8cde4aa00a16013d32fa463a2421a63c742/docs/releases/v0.2.1.md) · [告警契约](https://github.com/librecosta/uptime/blob/5e83d8cde4aa00a16013d32fa463a2421a63c742/contracts/alerts.md)

## Blender 验收

- 正面可辨认青灰铜顶、八角灯室、环绕平台和两栋较低的工作建筑。侧后方检查塔背检修件、建筑背部、闭合岩层与步道。 [正面等距](./renders/front.png) · [侧后方](./renders/rear.png)
- 顶视核对码头、石阶、两个工作区和塔基之间的通行关系。四段楼梯共 31 级，465 个踏面采样和其中 279 个中央净空采样均通过。四块地形均为闭合实体。 [顶部](./renders/top.png)
- 近景可辨认灯室玻璃与内部灯组、铜顶立缝、托臂、门窗凹进、栏杆、工作台、记录柜及两翼之间的连廊。 [守望塔](./renders/tower.png) · [监测与维护设施](./renders/station.png)
- 在 Blender 中逐一加载七座原创岛屿的源场景，以相同正交镜头、灯光和最长轴 23 Blender 单位重新渲染。风标岭用纵向的厚石塔和低而错落的沿岸建筑形成不同于其他岛屿的剪影。对照图用于审查结构、尺度和细节分布。 [八岛同尺度对照](./renders/comparison.png)

Blender 5.3 可独立重新打开源文件并从保存的正交相机渲染。场景保留 2,224 个可编辑岛屿对象、分组材质、五台正交相机和基础日光，无外部模型或贴图依赖。几何为本轮原创。仓库 `pnpm check` 通过。 [Blender 源文件](./uptime.blend)

## 复现

从仓库根目录执行。支持在对应 GPU 上追加 `--device OPTIX` 或 `--device CUDA`。

```powershell
blender --background --factory-startup --python-exit-code 1 --python assets/works/uptime/build.py -- --output .local/uptime-u1/rebuild --renders front rear top tower station
blender --background --factory-startup --python-exit-code 1 --python assets/works/uptime/review.py -- --source .local/uptime-u1/rebuild/uptime.blend --scratch .local/uptime-u1/review --output .local/uptime-u1/rebuild/renders/comparison.png
```

## U2 正式资产

逐对象比对确认 U1 的 2,224 个可编辑对象、构造和变换均保留。源文件内嵌两张 512 × 512 的 PBR 图集，切石、锌板、青灰铜与木构使用各自的表面细节和粗糙度。独立的 `Vigil Station · Web bake` 场景保存 UV、法线，以及烘到面角颜色的接触 AO、柔和日照遮挡和室内暖光。玻璃用低透明度的单面 PBR 混合，塔顶琥珀灯与室内暖灯有各自的静态发光强度。WORKS 对风标岭单独校准了默认正交视角、补光和反射。 [GLB](../../../public/works/islands/uptime.glb) · [透明轮盘预览](../../../public/works/previews/librecosta-uptime.webp) · [素材声明](../../../public/works/asset-notices.txt)

在 Chrome 157、AMD Radeon 上使用静态生产构建，检查正面、侧后方、高视角及放大后的铜顶、切石、木构和窗后工作台。灯室多角度仍能看到琥珀灯，无明显玻璃发黑或排序错误。通过 1920 × 1080、1440 × 900、960 × 720、390 × 844、320 × 568 的布局检查，移动端使用视口与触摸模拟。轮盘 18 张卡片正常，首屏 WebGL、GLB 和 Draco 均为零。八座岛分别按需请求各自模型。通过拖动、键盘、双指缩放、重置、相邻作品切换和返回焦点检查。阻断 GLB 或禁用 WebGL 时正确显示 560 × 420 的透明 WebP。连续五次打开和退出，每次释放 24 个缓冲区、6 个纹理及旧上下文，空闲时停止绘制。`pnpm check` 通过。

| 模型 | GLB 字节 | GLB 三角面 | 浏览器屏上 Draw Calls |
| --- | ---: | ---: | ---: |
| Uptime U2 | 1,459,392 | 69,086 | 4 |
| 旧 Signal | 652,372 | 39,942 | 10 |
| Harvest | 891,716 | 40,610 | 3 |
| Liquid Glass | 1,081,908 | 52,462 | 8 |
| SoFarAway | 1,111,248 | 58,340 | 9 |
| GopherAtlas | 1,873,704 | 93,110 | 3 |
| Tool4Furry | 1,831,560 | 91,354 | 4 |
| Wavefield | 933,268 | 113,576 | 7 |
| GoFurry | 1,826,616 | 81,340 | 3 |

屏上 Draw Calls 按交互重绘的一帧统计。Uptime 首帧另有 42 次离屏绘制用于生成环境反射，后续交互帧无离屏绘制。旧 Signal 一行取自 GF2 同一设备的测量。轮盘预览由正式单岛渲染器以 1.5 DPR 捕获后缩至 560 × 420。

从当前 Blender 源文件重烘导出，与正式 GLB 比对 SHA-256 一致。从 U1 源文件开始时可追加 `--blend <路径>`，另存包含材质、UV 和烘焙场景的可编辑版本。

```powershell
blender --background assets/works/uptime/uptime.blend --python-exit-code 1 --python assets/works/uptime/bake_web.py -- --glb public/works/islands/uptime.glb
```
