# WEB-V0.1-W2 · 单岛作品档案

`/works` 的 Ring 与 Arc 保留 18 个位置，01–08 从同一份项目数据读取，09–18 可以经过焦点和拖动浏览。正式卡片切入单岛详情，返回时恢复轮盘的位置、形态和焦点。渲染模块在档案进入后才动态加载。五个 Draco GLB 和三个原创岛屿继续使用各自已有的几何与材质。

## 媒体

八张透明 WebP 由单岛渲染器在 Chromium 以 800×600 离线拍摄，经 Lanczos 缩至 560×420，并以 WebP quality 84 编码。总计 216,150 字节。Tool4Furry 和 GopherAtlas 档案分别使用实际工具箱与出版首页截图。SoFarAway 的独立域名在验收时未能解析，档案提供已核实的项目页面。 [SoFarAway 项目](https://github.com/librecosta/sofaraway) · [GopherAtlas 首页](https://gopheratlas.com/)

许可记录见 [WORKS 素材声明](../../public/works/asset-notices.txt)、[Wenz MIT](../../public/works/wenz-license.txt)、[Draco](../../public/works/draco-license.txt) 和 [TuneShape MIT](../../public/License/tuneshape-orbit-reel.txt)。

## 浏览器验收

Chromium 157，1440×900，DPR 1，本机静态服务器关闭浏览器缓存。传输量取 Navigation 与 Resource Timing 的 `transferSize`。轮盘帧间隔是 90 次 `requestAnimationFrame` 的采样，反映这一轮浏览器调度，不能换算为 GPU 时间或实体手机帧率。

| 状态 | 请求数 | 传输量 | GLB | WebGL 上下文 | 轮盘帧间隔 P50 / P95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| W1 首屏 `08e05f3` | 18 | 819,680 B | 0 | 0 | 12.6 / 29.1 ms |
| W2 首屏 | 26 | 1,054,360 B | 0 | 0 | 8.4 / 16.7 ms |
| W2 首次打开 GoFurry，累计 | 33 | 2,548,169 B | 1 | 1 | — |

W2 首屏多出的 234,680 字节主要是八张预览。独立加载的五座 GLB 岛各请求自己的模型，Harvest、SoFarAway 和 GopherAtlas 使用已有原创建模，三者不请求 GLB 或 Draco。八岛各自首帧为 1–10 个 draw calls、3,350–39,942 个三角形。每座岛在静置采样窗口内新增绘制为零。八次返回均观察到 Canvas 移除、GPU buffer 删除和上下文释放。旧 A5 八岛总览的存档记录为 40 calls、141,964 个三角形，可作场景规模参考。 [A5 记录](./works-dark-atelier.md)

实测视口为 1920×1080、1440×900、960×720、390×844、320×568。覆盖预留卡、Ring / Arc、键盘与 Escape、触屏双指缩放、缩放按钮、鼠标拖动、平滑重置、打断进入、焦点恢复、禁用 WebGL 与模型请求失败降级。从档案导航到 ABOUT 后再次进入 WORKS，返回的是无 WebGL 的轮盘。原页面进入浏览器往返缓存时由页面可见性暂停绘制。`pnpm check` 通过。屏幕截图和原始测量保存在本地 `.local/works-w2/`。
