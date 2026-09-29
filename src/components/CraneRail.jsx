import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { IconSts } from '../components/icons/PortIcons';
import {
  clientDeltaToMeters,
  craneSegmentCss,
  layoutCranes,
} from '../lib/crane';

/**
 * Single 30m-scaled block per crane. Main info always on;
 * meter span reveals on hover. Drag moves position only.
 */
export default function CraneRail({
  cranes,
  quayLength,
  meterDirection,
  selectedId,
  onSelect,
  onEdit,
  onMove,
}) {
  const { t } = useI18n();
  const railRef = useRef(null);
  const dragRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const placed = layoutCranes(cranes, quayLength);

  useEffect(() => {
    const onPointerMove = (e) => {
      const d = dragRef.current;
      if (!d || !onMove) return;
      const rect = railRef.current?.getBoundingClientRect();
      if (!rect) return;
      const deltaM = clientDeltaToMeters(
        e.clientX - d.startX,
        rect.width,
        quayLength,
        meterDirection
      );
      onMove(d.id, d.originM + deltaM);
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setDraggingId(null);
      }
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [onMove, quayLength, meterDirection]);

  const beginDrag = (e, c) => {
    if (!onMove || (e.button != null && e.button !== 0)) return;
    if (e.target?.closest?.('.crane-edit')) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(c.id);
    dragRef.current = {
      id: c.id,
      startX: e.clientX,
      originM: c.fromM,
    };
    setDraggingId(c.id);
  };

  if (!placed.length) {
    return (
      <div className="crane-rail empty" ref={railRef}>
        <span>{t('crane.emptyHint')}</span>
      </div>
    );
  }

  return (
    <div className="crane-rail" ref={railRef} aria-label={t('crane.railLabel')}>
      {placed.map((c) => {
        const foot = craneSegmentCss(c.fromM, quayLength, meterDirection);
        const span = `${Math.round(c.fromM)}–${Math.round(c.toM)}m`;
        const tip = `${c.name} · ${c.mph}/h · ${span}`;
        const active = selectedId === c.id || draggingId === c.id;
        return (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            className={`crane-block ${active ? 'selected' : ''} ${draggingId === c.id ? 'dragging' : ''}`}
            style={{ left: foot.left, width: foot.width }}
            title={tip}
            aria-label={tip}
            onPointerDown={(e) => beginDrag(e, c)}
          >
            <strong className="crane-name">
              <IconSts size={14} />
              {c.name}
            </strong>
            <span className="crane-mph">{c.mph}/h</span>
            <span className="crane-span">{span}</span>
            {onEdit && (
              <button
                type="button"
                className="crane-edit"
                title={t('crane.edit')}
                aria-label={t('crane.edit')}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(c.id);
                }}
              >
                ✎
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
