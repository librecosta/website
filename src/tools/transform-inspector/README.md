# Transform Inspector

This browser-side module is reusable in Three.js projects. It uses Three.js TransformControls and a plain DOM panel. The host registers editable targets, requests rendering, and owns lifecycle cleanup. The module currently ships as source within this repository.

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

// On teardown, remove the panel and dispose of the editor.
unmount();
editor.dispose();
```

- Set `viewport` to the full camera render area. Use `allowPointer` to exclude host controls and `onDragChange` to suspend the host's pointer-driven camera while dragging. Mouse and pen drags are captured only on a gizmo hit. On touchscreens, edit the numerical fields and use native touch scrolling elsewhere.
- Drag the title bar or focus it and use the arrow keys to move the panel. The optional fourth argument constrains panel movement. It defaults to the browser viewport.
- Use `subscribe`, `getState`, and the editing commands to connect a custom UI. Animated or shared-mesh targets can provide `read` and `preview` adapters. Call `refresh()` after the host changes the baseline.
- Fields and exports are parent-local. Translation and rotation gizmos can use world or object axes. Scaling uses object axes. JSON stores target IDs, parent frame IDs, positions, XYZW quaternions, scales, and optional host context.
- `setEnabled(false)` hides the gizmo and retains session drafts. Undo, reset, or reload to return to the baseline. Disposal clears the drafts, listeners, and gizmo resources.
