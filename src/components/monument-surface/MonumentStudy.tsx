'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { artwork, hero, net, svgUrl } from './artwork';
import { faceLabels, layers, masterForFace, type Layer } from './layout';
import styles from './study.module.css';

const MonumentPreview = dynamic(() => import('./MonumentPreview'), { ssr: false,
  loading: () => <p className={styles.previewMessage} role="status">正在载入碑体</p>,
});
const modes = [
  { id: 'net', label: '四面展开' }, { id: 'layers', label: '分层拆解' }, { id: 'model', label: '碑体合成' },
] as const;
const angles = ['正面 / 右面', '右面 / 背面', '背面 / 左面', '左面 / 正面'];

export default function MonumentStudy() {
  const [mode, setMode] = useState<typeof modes[number]['id']>('net');
  const [layer, setLayer] = useState<Layer>('panels');
  const [guides, setGuides] = useState(false);
  const [angle, setAngle] = useState(0);
  const view = mode === 'layers' ? layer : 'composite';
  const label = modes.find(item => item.id === mode)!.label;
  const layerLabel = layers.find(item => item.id === layer)!;
  return <main className={styles.study}>
    <header className={styles.masthead}>
      <a href="/lab/expanse?debug=1">LibreCosta <span> / The Expanse</span></a>
      <span className={styles.reference}>P1-C1A4-B2</span>
    </header>
    <div className={styles.title}>
      <div><p>The Still Monolith</p><h1>静默巨碑展开图</h1></div>
      <p>正背面共用 F，左右面共用 S。金线沿面板边界布置，板内纵线在节点处分流再汇合。</p>
    </div>
    <div className={styles.switcher} role="group" aria-label="图板视图">
      {modes.map(item => <button key={item.id} type="button" aria-pressed={mode === item.id}
        onClick={() => setMode(item.id)}>{item.label}</button>)}
    </div>
    <div className={styles.workspace}>
      <section className={styles.board} aria-label={label}>
        <div className={styles.boardHeading}>
          <h2>{mode === 'layers' ? layerLabel.name : label}</h2>
          {mode !== 'model' && <label className={styles.guides}><input type="checkbox" checked={guides}
            onChange={event => setGuides(event.target.checked)} /> 显示折线与槽口</label>}
        </div>
        {mode === 'model' ? <>
          <div className={styles.viewport}><MonumentPreview angle={angle} /></div>
          <div className={styles.angles} role="group" aria-label="观察角度">
            {angles.map((item, index) => <button key={item} type="button" aria-pressed={angle === index}
              onClick={() => setAngle(index)}>{item}</button>)}
          </div>
        </> : <>
          <div className={styles.planScroll} tabIndex={0} aria-label="四面展开图，可横向滚动">
            {/* SVG dimensions use geometry units. Display scales to fit the board. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.plan} width={net.width} height={net.height}
              src={svgUrl(artwork(view, { proof: true, guides }))} alt={`${label}，按正面、右面、背面、左面依次展开`} />
          </div>
          <div className={styles.planFoot}><span>正面 → 右面 → 背面 → 左面 ↺</span><span>1 SVG 单位 = 1 场景单位</span></div>
        </>}
      </section>
      <aside className={styles.notes} aria-label="图例与导出">
        <div className={styles.spec}>
          <h2>{mode === 'layers' ? '选择图层' : '图层图例'}</h2>
          <ol className={styles.legend}>
            {layers.map((item, index) => <li key={item.id} data-layer={item.id}>
              {mode === 'layers' ? <button type="button" aria-pressed={layer === item.id} onClick={() => setLayer(item.id)}>
                <span>{index + 1}</span>{item.name}</button> : <p><span>{index + 1}</span>{item.name}</p>}
              <small>{item.note}</small>
            </li>)}
          </ol>
        </div>
        <div className={styles.spec}>
          <h2>面序与折合</h2>
          <p className={styles.dimensions}>{hero.scale.join(' × ')}<span>基宽 × 高 × 基深</span></p>
          <ol className={styles.faces}>{net.faces.map(face => <li key={face.id}>
            <strong>{faceLabels[face.id]}</strong><small>{masterForFace[face.id] === 'front' ? '宽幅封装纵板' : '窄幅封装纵板'}</small>
          </li>)}</ol>
          <p className={styles.seam}>左面外缘折回正面。顶底、槽内和倒角保留基材。</p>
        </div>
        <div className={styles.download}>
          <a download={`still-monolith-${view}${guides && mode !== 'model' ? '-guides' : ''}.svg`}
            href={svgUrl(artwork(view, { guides: guides && mode !== 'model' }))}>导出{mode === 'layers' ? '当前层' : '四面合成'} SVG</a>
          <a download={`still-monolith-F-${view}.svg`} href={svgUrl(artwork(view, { master: 'front' }))}>正面 F SVG</a>
          <a download={`still-monolith-S-${view}.svg`} href={svgUrl(artwork(view, { master: 'side' }))}>侧面 S SVG</a>
        </div>
      </aside>
    </div>
  </main>;
}
