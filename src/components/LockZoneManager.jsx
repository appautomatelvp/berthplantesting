import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { clampLockZone } from '../lib/lockZone';
import { DAY_KEYS } from '../lib/uiSettings';
import { CRANE_WIDTH_M } from '../lib/crane';

function uid() {
  return `lz${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** CRUD form for quay lock zones (isolated segment × time, reduced capacity). */
export default function LockZoneManager({
  lockZones,
  setLockZones,
  selectedId,
  setSelectedId,
  quayLength,
  cranes = [],
  shiftTimes = [],
}) {
  const { t } = useI18n();
  const L = Math.max(50, Number(quayLength) || 600);
  const list = lockZones || [];

  const add = () => {
    const id = uid();
    const zone = clampLockZone(
      {
        id,
        reason: t('lockZone.defaultReason'),
        fromMeter: Math.round(L * 0.35),
        lengthM: 60,
        etbDay: 'Mon',
        etbTime: '06:00',
        etdDay: 'Mon',
        etdTime: '18:00',
        capacityPct: 0,
      },
      L
    );
    setLockZones([...list, zone]);
    setSelectedId?.(id);
  };

  const update = (id, patch) => {
    setLockZones(
      list.map((z) => (z.id === id ? clampLockZone({ ...z, ...patch }, L) : z))
    );
  };

  const remove = (id) => {
    setLockZones(list.filter((z) => z.id !== id));
    if (selectedId === id) setSelectedId?.(null);
  };

  const selected = list.find((z) => z.id === selectedId) || null;

  const commit = (patch) => {
    if (selected) {
      update(selected.id, patch);
      return;
    }
    const id = uid();
    const zone = clampLockZone(
      {
        id,
        reason: t('lockZone.defaultReason'),
        fromMeter: 0,
        lengthM: Math.min(60, L),
        etbDay: 'Mon',
        etbTime: shiftTimes[0] || '07:30',
        etdDay: 'Mon',
        etdTime: shiftTimes[1] || '19:30',
        capacityPct: 0,
        ...patch,
      },
      L
    );
    setLockZones([...list, zone]);
    setSelectedId?.(id);
  };

  const nextDay = (day) => DAY_KEYS[(DAY_KEYS.indexOf(day) + 1) % DAY_KEYS.length];

  const applyShift = (from, to) => {
    const day = selected?.etbDay || 'Mon';
    const crosses = to <= from;
    commit({
      etbDay: day,
      etbTime: from,
      etdDay: crosses ? nextDay(day) : day,
      etdTime: to,
    });
  };

  const shifts = shiftTimes.filter(Boolean);
  const shiftPairs =
    shifts.length >= 2
      ? [
          [shifts[0], shifts[1]],
          [shifts[1], shifts[0]],
        ]
      : [];

  return (
    <div className="lock-zone-manager">
      <div className="block-fields-head">
        <span className="toolbar-label">{t('lockZone.title')}</span>
        <button type="button" className="btn" data-tip={t('tip.addMaint')} onClick={add}>
          {t('lockZone.add')}
        </button>
      </div>
      <p className="hint" style={{ margin: '0.25rem 0 0.55rem' }}>
        {t('lockZone.hint')}
      </p>

      {!list.length ? (
        <p className="hint">{t('lockZone.empty')}</p>
      ) : (
        <div className="maint-card-list">
          {list.map((z) => (
            <article
              key={z.id}
              className={`maint-card ${selectedId === z.id ? 'selected-row' : ''}`}
              onClick={() => setSelectedId?.(z.id)}
            >
              <div className="maint-card-top">
                <label>
                  <span>{t('lockZone.reason')}</span>
                  <input
                    value={z.reason}
                    onChange={(e) => update(z.id, { reason: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                <button
                  type="button"
                  className="btn-ghost danger"
                  data-tip={t('tip.remove')}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(z.id);
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="maint-card-metrics">
                <label>
                  <span>{t('lockZone.fromMeter')}</span>
                  <input
                    type="number"
                    value={Math.round(z.fromMeter ?? 0)}
                    onChange={(e) => update(z.id, { fromMeter: Number(e.target.value) })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                <label>
                  <span>{t('lockZone.lengthM')}</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(z.lengthM ?? 30)}
                    onChange={(e) => update(z.id, { lengthM: Number(e.target.value) })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                <label>
                  <span>{t('lockZone.capacityPct')}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={z.capacityPct ?? 0}
                    onChange={(e) => update(z.id, { capacityPct: Number(e.target.value) })}
                    onClick={(e) => e.stopPropagation()}
                    title={t('lockZone.capacityHint')}
                  />
                </label>
              </div>
              <div className="maint-card-times">
                <label>
                  <span>{t('lockZone.start')}</span>
                  <div className="datetime">
                    <select
                      value={z.etbDay}
                      onChange={(e) => update(z.id, { etbDay: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {DAY_KEYS.map((d) => (
                        <option key={d} value={d}>
                          {t(`days.${d}`)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={z.etbTime}
                      onChange={(e) => update(z.id, { etbTime: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </label>
                <label>
                  <span>{t('lockZone.end')}</span>
                  <div className="datetime">
                    <select
                      value={z.etdDay}
                      onChange={(e) => update(z.id, { etdDay: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {DAY_KEYS.map((d) => (
                        <option key={d} value={d}>
                          {t(`days.${d}`)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={z.etdTime}
                      onChange={(e) => update(z.id, { etdTime: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </label>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="maint-quick">
        <span className="toolbar-label">{t('lockZone.quickTitle')}</span>
        <p className="hint">{t('lockZone.quickHint')}</p>
        <div className="maint-quick-row">
          <button
            type="button"
            className="chip"
            data-tip={t('tip.tos')}
            onClick={() =>
              commit({
                reason: t('lockZone.tosReason'),
                fromMeter: 0,
                lengthM: L,
                capacityPct: 0,
              })
            }
          >
            {t('lockZone.quickTos')}
          </button>
          {shiftPairs.map(([from, to]) => (
            <button key={`${from}-${to}`} type="button" className="chip" data-tip={t('tip.shiftFill')} onClick={() => applyShift(from, to)}>
              {t('lockZone.quickShift', { from, to })}
            </button>
          ))}
          {(cranes || []).map((crane) => {
            const from = Math.round(Number(crane.positionM) || 0);
            const to = Math.min(L, from + CRANE_WIDTH_M);
            return (
              <button
                key={crane.id}
                type="button"
                className="chip"
                data-tip={t('tip.craneFill')}
                onClick={() =>
                  commit({
                    reason: crane.name || 'STS',
                    fromMeter: from,
                    lengthM: Math.max(1, to - from),
                    capacityPct: 0,
                  })
                }
              >
                {t('lockZone.quickCrane', { name: crane.name || 'STS' })} {from}–{to}m
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
