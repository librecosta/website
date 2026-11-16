# Harvest — The Collector’s Workshop

层畴屿 · 山地数据采集工坊。WEB-V0.1-W3-H1 美术验收源文件为 [harvest.blend](./harvest.blend)，与网站运行资产分开。岛体、机械、建筑、道路、植被和货运道具均为 LibreCosta 原创几何。相机和灯光放在独立的审阅 Collection。文件内保留独立零件、材质槽、倒角修改器和可编辑管线，无外部贴图或链接库。

## 渲染

- [正面等距](./renders/front.png)。前景的吊运码头、中央处理庭院和后方采集塔形成三层轮廓。
- [侧后方](./renders/rear.png)。可以检查采集盘背肋、叉架、塔身侧面、校准棚和岩层收边。
- [顶部](./renders/top.png)。可追踪从码头、跨崖石阶、庭院至折返木梯和塔入口的路线。
- [采集塔特写](./renders/collector.png)。铜接收盘由回转基座、偏置支架和馈源支杆组成，塔顶有检修盖和护栏，山脊侧设风速计和独立采样设备。
- [处理工坊特写](./renders/workshop.png)。木石分拣屋、错层铜顶压机房和半开放校准棚采用不同结构。铜管沿山体入屋，经庭院埋管与带手轮的回流泵连通。

## 对照

将仓库内的 Bay、Foundry 和 Signal GLB 导入 Blender 5.3，沿用 WORKS 方位和约 23° 俯角，统一用实际投影边界占高、占宽和同一组灯光构图。对照中保留参考模型原有材质，参考几何仅用于渲染。 [对照图](./renders/comparison.png) · [参考资产来源和许可](../../../public/works/asset-notices.txt)

| 对照岛 | 参照要点 | Harvest 的对应处理 |
| --- | --- | --- |
| Bay | 屋檐、木构门窗与码头道具在近景下仍清晰 | 分拣屋有分块铜板屋顶、独立雨棚、窗格和砌筑基座，装卸区用吊机、箱和桶组织工作面 |
| Foundry | 远景主地标清晰，码头与阶梯有明确落点 | 用偏置接收器抬高轮廓，石墩承接跨崖平台，庭院与上山木梯分流 |
| Signal | 岩层和环山路线能在旋转时连续读出 | 峭壁设岸台、碎石带和后侧松林，高地通过折返木梯到达，背面保留完整岩壁轮廓 |

Harvest 的庭院空间更紧凑，主轮廓由矮工坊、采集塔和吊臂形成。对照渲染审阅了远景剪影、中景建筑关系以及近景节点。重新打开成品源文件，检查主体岩体闭合、材质槽存在、五台相机可用和无丢失资源。按踏面采样检查了岸边石阶、两段折返梯和塔门台阶的地形净空。仓库 `pnpm check` 通过。

## 复现和下一轮

```powershell
blender --background --factory-startup --python-exit-code 1 --python assets/works/harvest/build.py -- --renders front rear top collector workshop
blender --background --factory-startup --python-exit-code 1 --python assets/works/harvest/render_references.py -- .local/harvest-h1/benchmarks
```

H2 的材质重点是区分铜盘本体、氧化边和支架磨损，给石灰抹面、木材端纹和崖壁苔藓增加尺度一致的变化。随后为目标材质整理 UV，评估遮蔽和环境光烘焙测试，以及近景下窗内光与信号灯的亮度。源文件保留建模用零件和修改器供后续编辑。
