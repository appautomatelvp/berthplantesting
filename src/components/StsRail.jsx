import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { layoutStsCranes, stsCssLeft } from '../lib/sts';

/** Horizontal STS markers along the quay meter axis. */
export default function StsRail({ cranes, quayLength, meterDirection, selectedId, onSelect }) {
  const { t } = useI18n();
  const placed = layoutStsCranes(cranes, quayLength);

  if (!placed.length) {
    return (
      <div className="sts-rail empty">
        <span>{t('sts.emptyHint')}</span>
      </div>
    );
  }

  return (
    <div className="sts-rail" aria-label={t('sts.railLabel')}>
      {placed.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`sts-marker ${selectedId === c.id ? 'selected' : ''}`}
          style={{ left: stsCssLeft(c.positionM, quayLength, meterDirection) }}
          title={`${c.name} · #${c.order} · ${c.mph} mph · ${Math.round(c.positionM)}m`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(c.id);
          }}
        >
          <span className="sts-order">{c.order}</span>
          <span className="sts-name">{c.name}</span>
          <span className="sts-mph">{c.mph}/h</span>
        </button>
      ))}
    </div>
  );
}
