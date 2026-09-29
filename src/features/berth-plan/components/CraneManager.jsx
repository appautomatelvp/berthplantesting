import React from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext';
import { clampCranePosition, CRANE_WIDTH_M } from '../utils/crane';

function uid() {
  return `crn${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** CRUD + reorder for quay cranes (fixed 30m width). */
export default function CraneManager({ cranes, setCranes, selectedId, setSelectedId, quayLength, compact = false }) {
  const { t } = useI18n();
  const sorted = [...(cranes || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const L = Math.max(CRANE_WIDTH_M, Number(quayLength) || 600);

  const renumber = (list) => list.map((c, i) => ({ ...c, order: i + 1 }));

  const addCrane = () => {
    const id = uid();
    const n = sorted.length;
    const positionM = clampCranePosition(
      n === 0 ? 0 : (sorted[n - 1].positionM ?? 0) + CRANE_WIDTH_M + 5,
      L
    );
    const next = renumber([
      ...sorted,
      {
        id,
        name: `Crane-${String(n + 1).padStart(2, '0')}`,
        mph: 28,
        order: n + 1,
        positionM,
      },
    ]);
    setCranes(next);
    setSelectedId?.(id);
  };

  const update = (id, patch) => {
    setCranes(
      cranes.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.positionM != null) {
          next.positionM = clampCranePosition(patch.positionM, L);
        }
        return next;
      })
    );
  };

  const remove = (id) => {
    setCranes(renumber(sorted.filter((c) => c.id !== id)));
    if (selectedId === id) setSelectedId?.(null);
  };

  const move = (id, dir) => {
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[j]] = [next[j], next[idx]];
    setCranes(renumber(next));
  };

  return (
    <div className={`crane-manager ${compact ? 'is-compact' : ''}`}>
      <div className="block-fields-head">
        <span className="toolbar-label">{t('crane.title')}</span>
        <button type="button" className="btn" data-tip={t('tip.addCrane')} onClick={addCrane}>
          {t('crane.add')}
        </button>
      </div>
      <p className="hint" style={{ margin: '0.25rem 0 0.55rem' }}>
        {t('crane.hint', { w: CRANE_WIDTH_M })}
      </p>
      {!sorted.length ? (
        <p className="hint">{t('crane.emptyHint')}</p>
      ) : compact ? (
        <div className="drawer-fit-list">
          <div className="drawer-fit-head">
            <span>{t('crane.order')}</span>
            <span>{t('crane.name')}</span>
            <span>{t('crane.mph')}</span>
            <span>{t('crane.position')}</span>
            <span />
          </div>
          {sorted.map((c) => (
            <div
              key={c.id}
              className={`drawer-fit-row ${selectedId === c.id ? 'selected-row' : ''}`}
              onClick={() => setSelectedId?.(c.id)}
            >
              <div className="sts-order-controls">
                <button type="button" className="btn-ghost" data-tip={t('tip.craneUp')} onClick={() => move(c.id, -1)}>
                  ↑
                </button>
                <span>{c.order}</span>
                <button type="button" className="btn-ghost" data-tip={t('tip.craneDown')} onClick={() => move(c.id, 1)}>
                  ↓
                </button>
              </div>
              <input
                value={c.name}
                onChange={(e) => update(c.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
              <input
                type="number"
                min={1}
                value={c.mph}
                onChange={(e) => update(c.id, { mph: Number(e.target.value) || 1 })}
                onClick={(e) => e.stopPropagation()}
              />
              <input
                type="number"
                value={Math.round(c.positionM ?? 0)}
                onChange={(e) => update(c.id, { positionM: Number(e.target.value) })}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                className="btn-ghost danger"
                data-tip={t('tip.remove')}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(c.id);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="sts-table-wrap">
          <table className="data-table sts-table">
            <thead>
              <tr>
                <th>{t('crane.order')}</th>
                <th>{t('crane.name')}</th>
                <th>{t('crane.mph')}</th>
                <th>{t('crane.position')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c.id}
                  className={selectedId === c.id ? 'selected-row' : ''}
                  onClick={() => setSelectedId?.(c.id)}
                >
                  <td className="sts-order-cell">
                    <div className="sts-order-controls">
                      <button type="button" className="btn-ghost" data-tip={t('tip.craneUp')} onClick={() => move(c.id, -1)}>
                        ↑
                      </button>
                      <span>{c.order}</span>
                      <button type="button" className="btn-ghost" data-tip={t('tip.craneDown')} onClick={() => move(c.id, 1)}>
                        ↓
                      </button>
                    </div>
                  </td>
                  <td>
                    <input
                      className="cell"
                      value={c.name}
                      onChange={(e) => update(c.id, { name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <input
                      className="cell num"
                      type="number"
                      min={1}
                      value={c.mph}
                      onChange={(e) => update(c.id, { mph: Number(e.target.value) || 1 })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <input
                      className="cell num"
                      type="number"
                      value={Math.round(c.positionM ?? 0)}
                      onChange={(e) => update(c.id, { positionM: Number(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-ghost danger"
                      data-tip={t('tip.remove')}
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(c.id);
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
