# WORKS · WEB-V0.1-A3

`/works` 移植了 [Isometria 源码](https://github.com/shellcat-com/formwork-isometria/tree/314b11cfaec44cdd43c91b4382c23f901f9e3cae) 的地块高度函数、正交机位、日间配色、光照、灯塔与拖动旋转。原演示地址返回 404，浏览器对照使用[项目组织的演示](https://shellcat-com.github.io/formwork-isometria/)，其 `main.js` 和 `styles.css` 与上述提交一致。本地使用已安装的 Three.js r187，原有柔和阴影由这一版本的过滤 PCF 实现。[原版许可证](../../public/works/isometria-license.txt)

先在 Next.js 中用原版 11×11 地块和机位渲染基准，再扩为 13×13。基准保留了原版的岛屿轮廓、地块厚度和光照方向。最终沙盘延续海蓝、沙岸、草地和岩石高地的色彩，以灯塔为视觉中心，八个地标分布在不同台阶和岸段。镜头始终采用正交投影，构图随画布尺寸适配。旋转由拖动触发，悬停或键盘聚焦突出地标，详情和索引共用同一份项目数据。Harvest 使用真实的命令行帮助输出作为预览。[项目数据](../../src/components/works/projects.ts) · [场景几何](../../src/components/works/isometria-world.ts) · [素材来源](../../public/works/asset-notices.txt)

- `pnpm check` 通过，`/works` 成功静态导出。
- Chrome 157 生产预览验证 1440×900、1920×1080、390×844 和 320×568。四种视口均完整显示总览，默认与旋转边界的八个 44 CSS px 圆形点击区互不重叠。逐项打开详情，核对图片、外链、完整面板和水平溢出。移动端使用浏览器触屏模拟，验证了从地标起拖不会误打开详情。
- 验证悬停、键盘 Enter、索引选项、Escape 焦点恢复、减少动态效果、WebGL 禁用与丢失后恢复。禁用 JavaScript 后，静态 HTML 列表仍有全部项目链接。正常浏览无控制台错误，网络记录中没有 The Expanse 场景或资产请求。
- `/works?worksDebug` 的 Canvas 记录 Three.js 指标。四种视口每帧均为 72 Draw Calls 和 5,280 Triangles，含阴影等渲染通道。GPU 资源计数为 5 个几何体、2 张纹理，阴影图为 1024×1024。DPR 上限为 1.5。1440×900、DPR 1、SwiftShader 软件渲染下，交互采样的帧间隔中位数为 41.6 ms，P95 为 75.0 ms（20 个间隔）。静止或隐藏时不持续渲染。
- 本地截图在 `.local/works-a3/`。其中 `upstream-scene-1440.png` 隐去了原页面浮层以便比较，`next-baseline-1440.png` 是未加入 LibreCosta 内容时的基准。最终总览见 `works-1440.png`、`works-1920.png`、`works-390.png` 和 `works-320.png`，另有详情、索引、悬停、旋转与回退截图及 `browser-report.json`。
