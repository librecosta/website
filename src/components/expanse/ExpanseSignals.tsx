import { useLayoutEffect, useRef, type RefObject } from 'react';
import { observationIds, observationRecords, type ObservationId } from './narrative';
import type { ObservationElements } from './ObservationProjection';
import styles from './signals.module.css';

function SignalCard({ id, elements, focusCard, invalidate, onClose }: {
  id: ObservationId; elements: RefObject<ObservationElements>; focusCard: RefObject<boolean>;
  invalidate: () => void; onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null), close = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const node = panel.current!;
    const card = { id, node, close: close.current!, focus: focusCard.current, width: node.offsetWidth, height: node.offsetHeight };
    elements.current.card = card;
    invalidate();
    const observer = new ResizeObserver(() => {
      card.width = node.offsetWidth;
      card.height = node.offsetHeight;
      invalidate();
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      elements.current.card = null;
      invalidate();
    };
  }, [id, elements, focusCard, invalidate]);
  const record = observationRecords[id];
  return <section ref={panel} id="expanse-signal-card" className={styles.card}
    aria-labelledby="expanse-signal-name" data-signal-card={id} lang="zh-CN">
    <div className={styles.cardGlass}>
      <svg className={styles.cardEdge} viewBox="0 0 260 100" preserveAspectRatio="none" aria-hidden="true" fill="none">
        <path d="M1 85V14L15 1H112M122 1H248L259 12V37M259 73V87L246 99H172M149 99H15" />
        <path d="M1 34V14L15 1H37M230 99H246L259 87V78" />
      </svg>
      <header className={styles.cardHeader}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none">
          <path d="M1 5V1h4m6 0h4v4m0 6v4h-4m-6 0H1v-4M8 4v8M4 8h8" stroke="currentColor" />
        </svg>
        <span className={styles.signalNumber}>{record.id}</span>
        <h2 id="expanse-signal-name">{record.name}</h2>
        <button type="button" ref={close} aria-label="关闭全息信息卡" onClick={onClose}>×</button>
      </header>
      <div className={styles.cardText}>{record.lines.map(line => <p key={line}>{line}</p>)}</div>
      <i className={styles.port} aria-hidden="true" />
    </div>
  </section>;
}

export function ExpanseSignals({ elements, enabled, active, read, onSelect, onClose, focusCard, invalidate }: {
  elements: RefObject<ObservationElements>; enabled: boolean; active: ObservationId | null;
  read: ReadonlySet<ObservationId>; onSelect: (id: ObservationId, keyboard: boolean) => void;
  onClose: () => void; focusCard: RefObject<boolean>; invalidate: () => void;
}) {
  return <div className={styles.signals} hidden={!enabled}>
    {observationIds.map(id => {
      const record = observationRecords[id];
      return <button key={id} className={styles.marker} type="button" data-observation={id}
        ref={button => { elements.current.buttons[id] = button; }}
        aria-label={`${record.id} · ${record.name}${read.has(id) ? '，已阅读' : ''}`}
        aria-expanded={active === id} aria-controls={active === id ? 'expanse-signal-card' : undefined}
        data-read={read.has(id)} onClick={event => onSelect(id, event.detail === 0)}>
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
    {enabled && active && <SignalCard key={active} id={active} elements={elements}
      focusCard={focusCard} onClose={onClose} invalidate={invalidate} />}
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
