import type { TransformInspector } from './editor';

const fields = [
  { key: 'position', label: '位置' },
  { key: 'rotation', label: '旋转 °' },
  { key: 'scale', label: '缩放' },
] as const;
const axes = ['X', 'Y', 'Z'] as const;

function enablePanelDrag(panel: HTMLElement, handle: HTMLButtonElement, bounds?: HTMLElement) {
  const view = panel.ownerDocument.defaultView!;
  const events = new AbortController();
  const listen = { signal: events.signal };
  const capture = { ...listen, capture: true };
  let x = 0, y = 0;
  let drag: { pointer: number; startX: number; startY: number; offsetX: number; offsetY: number } | undefined;

  function moveTo(nextX: number, nextY: number) {
    const rect = panel.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const area = bounds?.getBoundingClientRect();
    const left = Math.max(0, area?.left ?? 0), top = Math.max(0, area?.top ?? 0);
    const right = Math.min(view.innerWidth, area?.right ?? view.innerWidth);
    const bottom = Math.min(view.innerHeight, area?.bottom ?? view.innerHeight);
    const minX = x + left - rect.left, minY = y + top - rect.top;
    const maxX = x + right - rect.right, maxY = y + bottom - rect.bottom;
    const clampedX = Math.max(minX, Math.min(nextX, maxX));
    const clampedY = Math.max(minY, Math.min(nextY, maxY));
    if (clampedX === x && clampedY === y) return;
    x = clampedX;
    y = clampedY;
    panel.style.translate = `${x}px ${y}px`;
  }

  function finish() {
    if (!drag) return;
    const { pointer } = drag;
    drag = undefined;
    if (handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
    delete handle.dataset.dragging;
  }

  handle.addEventListener('pointerdown', event => {
    if (drag || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    handle.setPointerCapture(event.pointerId);
    drag = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: x, offsetY: y };
    handle.dataset.dragging = 'true';
  }, listen);
  view.addEventListener('pointermove', event => {
    if (drag?.pointer !== event.pointerId) return;
    if (!(event.buttons & 1)) { finish(); return; }
    event.stopPropagation();
    moveTo(drag.offsetX + event.clientX - drag.startX, drag.offsetY + event.clientY - drag.startY);
  }, capture);
  const release = (event: PointerEvent) => { if (drag?.pointer === event.pointerId) finish(); };
  view.addEventListener('pointerup', release, capture);
  view.addEventListener('pointercancel', release, capture);
  view.addEventListener('blur', finish, listen);
  handle.addEventListener('keydown', event => {
    const step = event.shiftKey ? 48 : 16;
    switch (event.key) {
      case 'ArrowLeft': moveTo(x - step, y); break;
      case 'ArrowRight': moveTo(x + step, y); break;
      case 'ArrowUp': moveTo(x, y - step); break;
      case 'ArrowDown': moveTo(x, y + step); break;
      default: return;
    }
    event.preventDefault();
  }, listen);

  const clamp = () => moveTo(x, y);
  view.addEventListener('resize', clamp, listen);
  const observer = new ResizeObserver(clamp);
  observer.observe(panel);
  if (bounds) observer.observe(bounds);
  return () => { finish(); events.abort(); observer.disconnect(); };
}

export function mountTransformInspector(host: HTMLElement, editor: TransformInspector, close: () => void, bounds?: HTMLElement) {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { color: #e8eee9; font: 13px/1.4 system-ui, sans-serif; pointer-events: none; }
      section { box-sizing: border-box; max-height: inherit; overflow: auto; border: 1px solid #52615a;
        border-radius: 9px; background: #19211f; padding: 13px; pointer-events: auto; }
      header, .row, .checks, footer { display: flex; align-items: center; gap: 8px; }
      header { justify-content: space-between; margin-bottom: 10px; }
      h2 { flex: 1; margin: 0; }
      button.grab { display: flex; align-items: center; width: 100%; padding: 0 5px 0 0;
        border: 0; background: transparent; cursor: grab; font-size: 14px; font-weight: 650;
        gap: 8px; touch-action: none; user-select: none; }
      button.grab[data-dragging] { cursor: grabbing; }
      .grab svg { flex: none; opacity: .6; }
      .row { margin: 8px 0; }
      select, input, button { color: inherit; font: inherit; }
      button, select, input[type=number] { background: #252e2b; border: 1px solid #58635e;
        border-radius: 4px; padding: 4px 6px; min-height: 27px; box-sizing: border-box; }
      button, select, input[type=checkbox] { cursor: pointer; }
      button:hover:enabled { background: #3a4741; }
      button:disabled, select:disabled, input:disabled { opacity: .5; cursor: default; }
      :focus-visible { outline: 2px solid #a5d8c4; outline-offset: 1px; }
      select { flex: 1; min-width: 0; }
      .checks { justify-content: space-between; }
      .checks label { display: inline-flex; align-items: center; gap: 3px; }
      .matrix { display: grid; grid-template-columns: 48px repeat(3, minmax(0, 1fr));
        gap: 5px; align-items: center; margin: 9px 0; }
      input[type=number] { width: 100%; font-size: 11.5px; letter-spacing: -.015em;
        font-variant-numeric: tabular-nums; appearance: textfield; }
      input[type=number]::-webkit-inner-spin-button { appearance: none; }
      .axis { padding-left: 6px; color: #b9cec3; font-size: 11px; }
      .note, output { color: #b9cec3; font-size: 11px; }
      .note { margin: 8px 0 10px; }
      footer { flex-wrap: wrap; }
      footer > span { flex: 1; }
      output { display: block; margin-top: 5px; min-height: 1.4em; }
    </style>
    <section aria-label="物体变换调试">
      <header>
        <h2><button type="button" id="move-panel" class="grab" aria-label="移动物体变换面板"
          title="拖动面板，或用方向键移动">
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
            <path d="M2 2h6M2 6h6M2 10h6" stroke="currentColor" fill="none"/>
          </svg>
          物体变换
        </button></h2>
        <button type="button" id="close">关闭</button>
      </header>
      <label class="row">目标 <select id="target"><option value="">选择物体</option></select></label>
      <div class="row">
        <select id="mode" aria-label="变换模式">
          <option value="translate">移动</option><option value="rotate">旋转</option><option value="scale">缩放</option>
        </select>
        <select id="space" aria-label="手柄坐标">
          <option value="world">世界轴</option><option value="local">物体轴</option>
        </select>
      </div>
      <div class="checks">
        <label><input id="gizmo" type="checkbox">显示三轴手柄</label>
        <label><input id="uniform" type="checkbox">等比缩放</label>
      </div>
      <div class="matrix">
        <span></span>${axes.map(axis => `<span class="axis" aria-hidden="true">${axis}</span>`).join('')}
        ${fields.map(({ key, label }) => `<span>${label}</span>${axes.map((axis, index) =>
          `<input id="${key}-${index}" type="number" step="any" aria-label="${label} ${axis}">`).join('')}`).join('')}
      </div>
      <p class="note">数值相对父级。旋转使用 XYZ 欧拉角，缩放手柄沿物体轴。</p>
      <footer>
        <button type="button" id="undo">撤销</button><button type="button" id="reset">重置</button><span></span>
        <button type="button" id="copy">复制 JSON</button><button type="button" id="download">下载</button>
      </footer>
      <output aria-live="polite"></output>
    </section>`;

  const element = <T extends HTMLElement>(id: string) => root.getElementById(id) as T;
  const target = element<HTMLSelectElement>('target'), mode = element<HTMLSelectElement>('mode');
  const space = element<HTMLSelectElement>('space');
  const gizmo = element<HTMLInputElement>('gizmo'), uniform = element<HTMLInputElement>('uniform');
  const undo = element<HTMLButtonElement>('undo'), reset = element<HTMLButtonElement>('reset');
  const copy = element<HTMLButtonElement>('copy'), download = element<HTMLButtonElement>('download');
  const status = root.querySelector('output')!;
  const numbers = fields.map(({ key }) => ([0, 1, 2] as const).map(axis => element<HTMLInputElement>(`${key}-${axis}`)));
  const format = (number: number) => String(Number(number.toFixed(6)));
  for (const item of editor.targets) target.add(new Option(item.label, item.id));

  function render() {
    const state = editor.getState();
    target.value = state.id;
    mode.value = state.mode;
    space.value = state.mode === 'scale' ? 'local' : state.space;
    gizmo.checked = state.gizmo;
    uniform.checked = state.uniform;
    target.disabled = state.dragging;
    mode.disabled = gizmo.disabled = uniform.disabled = !state.id || state.dragging;
    space.disabled = mode.disabled || state.mode === 'scale';
    undo.disabled = !state.canUndo || state.dragging;
    reset.disabled = !state.canReset || state.dragging;
    copy.disabled = download.disabled = !state.changed || state.dragging;
    const values = [state.transform?.position, state.rotation, state.transform?.scale];
    numbers.forEach((row, group) => row.forEach((input, axis) => {
      input.disabled = !state.id || state.dragging;
      if (root.activeElement !== input || input.disabled) {
        const value = values[group]?.[axis];
        input.value = value === undefined ? '' : format(value);
      }
    }));
  }

  const unsubscribe = editor.subscribe(render);
  const stopDragging = enablePanelDrag(root.querySelector('section')!, element<HTMLButtonElement>('move-panel'), bounds);
  element('close').onclick = close;
  target.onchange = () => { status.value = ''; editor.select(target.value); };
  mode.onchange = () => editor.setMode(mode.value as 'translate' | 'rotate' | 'scale');
  space.onchange = () => editor.setSpace(space.value as 'world' | 'local');
  gizmo.onchange = () => editor.setGizmo(gizmo.checked);
  uniform.onchange = () => editor.setUniform(uniform.checked);
  undo.onclick = () => { status.value = ''; editor.undo(); };
  reset.onclick = () => { status.value = ''; editor.reset(); };
  fields.forEach(({ key }, group) => ([0, 1, 2] as const).forEach(axis => {
    const input = numbers[group][axis];
    input.onchange = () => {
      const accepted = editor.setAxis(key, axis, input.valueAsNumber);
      status.value = accepted ? '' : '请输入有效数值。缩放不可为零。';
      const state = editor.getState();
      const value = key === 'rotation' ? state.rotation?.[axis] : state.transform?.[key][axis];
      input.value = value === undefined ? '' : format(value);
    };
    input.onkeydown = event => { if (event.key === 'Enter') input.blur(); };
  }));
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(editor.exportJSON());
      status.value = '已复制 JSON';
    } catch {
      status.value = '剪贴板不可用，请下载 JSON。';
    }
  };
  download.onclick = () => {
    const href = URL.createObjectURL(new Blob([editor.exportJSON()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = 'transform-inspector.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    status.value = '已导出 JSON';
  };
  render();
  return () => {
    stopDragging();
    unsubscribe();
    root.replaceChildren();
  };
}
