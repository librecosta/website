import { useLayoutEffect, useRef, type RefObject } from 'react';
import { observationIds, observationRecords, type ObservationId } from './narrative';
import type { ObservationElements } from './ObservationProjection';
import styles from './signals.module.css';

function SignalCard({ id, elements, invalidate }: {
  id: ObservationId; elements: RefObject<ObservationElements>; invalidate: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    elements.current.card = { id, node: panel.current! };
    invalidate();
    return () => {
      elements.current.card = null;
      invalidate();
    };
  }, [id, elements, invalidate]);
  const record = observationRecords[id];
  return <section ref={panel} id="expanse-signal-card" className={styles.srOnly}
    aria-labelledby="expanse-signal-name" data-signal-card={id} lang="zh-CN">
    <h2 id="expanse-signal-name">{record.name}</h2>
    {record.lines.map(line => <p key={line}>{line}</p>)}
  </section>;
}

export function ExpanseSignals({ elements, enabled, active, read, onSelect, invalidate }: {
  elements: RefObject<ObservationElements>; enabled: boolean; active: ObservationId | null;
  read: ReadonlySet<ObservationId>; onSelect: (id: ObservationId) => void; invalidate: () => void;
}) {
  return <div className={styles.signals} hidden={!enabled}>
    {observationIds.map(id => {
      const record = observationRecords[id];
      return <button key={id} className={styles.marker} type="button" data-observation={id}
        ref={button => { elements.current.buttons[id] = button; }}
        aria-label={`${record.id} · ${record.name}${read.has(id) ? '，已阅读' : ''}`}
        aria-expanded={active === id} aria-controls={active === id ? 'expanse-signal-card' : undefined}
        data-read={read.has(id)} onClick={() => onSelect(id)}>
        <svg className={styles.locator} viewBox="0 0 44 44" fill="none" aria-hidden="true">
          <circle cx="22" cy="22" r="7" stroke="currentColor" strokeDasharray="8 3" strokeWidth="1.2" />
          <circle cx="22" cy="22" r="1.5" fill="currentColor" />
          <path className={styles.brackets} d="M12 17v-5h5m10 0h5v5m0 10v5h-5m-10 0h-5v-5M22 9v3m0 20v3m13-13h3"
            stroke="currentColor" />
        </svg>
        {active === id && <i className={styles.scan} aria-hidden="true" />}
        <span className={styles.label} aria-hidden="true">{record.id} / {record.name}</span>
      </button>;
    })}
    {enabled && active && <SignalCard key={active} id={active} elements={elements} invalidate={invalidate} />}
  </div>;
}

export function SignalReadouts({ elements }: { elements: RefObject<ObservationElements> }) {
  return <details className={styles.debugSignals}>
    <summary>观测锚点 · 世界 XYZ</summary>
    <ul>{observationIds.map(id => <li key={id}>
      <span>{observationRecords[id].id} {observationRecords[id].name}</span>
      <span ref={node => { elements.current.readouts[id] = node; }} data-anchor-readout={id}>unmounted</span>
    </li>)}
      <li><span>全息卡</span><span ref={node => { elements.current.cardReadout = node; }} data-card-readout>关闭</span></li>
    </ul>
  </details>;
}
