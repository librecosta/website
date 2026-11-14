# WORKS · 全息作品海图

`/works` 以全屏海图呈现五个虚构区域与八个项目。沿用 [A0 的区域与项目分布](works-cartographic-art-direction.md)，以原创建模高度场重做地貌。山脊、盆地、河谷和海岸壁使用同一个斜投影。页面加载约 104 KiB 的 WebP 地形，投影后的锚点和 HTML 按钮叠在地面上。

玻璃球只显示项目图形。悬停或键盘聚焦时显示球外名称。选中时地形轻移，半透明档案面板保留后方地貌。竖屏将选中球移至档案上方。项目索引与项目档案互斥，Escape 关闭当前面板并恢复焦点。短视口索引将摘要缩为一行，完整文案保留在档案里。关闭 JavaScript 时，静态 HTML 提供项目索引和入口。

[项目数据](../../src/components/works/projects.ts) 保存坐标、说明、状态、预览和项目入口。[地形生成脚本](../../scripts/render-works-terrain.py) 在离线环境使用 Pillow、NumPy 和 SciPy。新增地面坐标后运行 `python scripts/render-works-terrain.py` 更新锚点投影，站点构建使用已生成的资源。项目预览在打开档案时加载。[素材来源](../../public/works/asset-notices.txt)

## 验收

- Chromium 静态产物验证 1440×900 总览、项目档案、索引。八个项目可通过 Enter 或 Space 打开，标题获得焦点，Escape 回到项目球。索引可直接打开 GopherAtlas 或返回原档案。
- 390×844 和 320×568 总览的八个触控目标均为 44×44 CSS px，中心可命中且不互相覆盖。320×568 下可看见选中球和完整档案，索引八项同屏可见。真实手机和减少动态效果系统设置未实测。
- `pnpm check` 通过。`/works` 仍为静态导出，无新增运行依赖，浏览器控制台无警告或错误。浏览器截图和检查日志保存在 `.local/works/holographic-*`。
