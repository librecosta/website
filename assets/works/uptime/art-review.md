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

## U2 待办

人工美术验收后再细化屋面、石材、木构和金属材质，烘焙接触阴影与日光遮挡，并在 Three.js 中验证灯室玻璃、信号灯可见性及透明排序。最终再导出和集成 Web 资产。
