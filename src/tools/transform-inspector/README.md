# Transform Inspector

这个目录可直接复制到浏览器端 Three.js 项目。核心使用 Three.js 与其 TransformControls，面板使用原生 DOM。宿主负责目标注册、渲染触发和释放时机。当前按项目内模块使用，暂不发布为包。

```ts
import { applyTransform, createTransformInspector, readTransform } from './editor';
import { mountTransformInspector } from './panel';

const initial = readTransform(object);
const editor = createTransformInspector({
  scene,
  camera,
  viewport,
  invalidate: requestSceneRender,
  targets: [{
    id: 'sign',
    label: 'Sign',
    parent: object.parent ?? scene,
    frameId: 'sign-parent',
    read: () => initial,
    preview: draft => applyTransform(object, draft ?? initial),
  }],
});
const unmount = mountTransformInspector(panelHost, editor, closePanel, viewport);
editor.select('sign');

// 在调试界面和场景销毁时分别清理。
unmount();
editor.dispose();
```

- `viewport` 对应相机的完整渲染区域。用 `allowPointer` 排除页面控件，用 `onDragChange` 暂停宿主的指针视角响应。鼠标或笔命中手柄时才接管拖动。触屏通过数值字段编辑，保留原生触摸滚动。
- 面板可用标题栏拖动，也可聚焦标题后用方向键移动。可选的第四个参数限制面板拖动范围，缺省时使用浏览器视口。
- 也可以用 `subscribe`、`getState` 和编辑命令连接自己的 UI。动画驱动或共享网格的对象可以注册 `read` 和 `preview` 适配器。宿主基准变化后调用 `refresh()`。
- 数值字段和导出均相对目标父节点。手柄可按世界轴或物体轴移动及旋转，缩放沿物体轴。JSON 记录修改对象的 ID、坐标系、位置、XYZW 四元数、缩放，以及宿主提供的可选上下文。
- `setEnabled(false)` 隐藏手柄并保留会话草稿。可通过撤销、重置或刷新页面恢复初始状态。销毁会清除草稿、监听器和手柄资源。
