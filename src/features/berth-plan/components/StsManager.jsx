import React from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext';

function uid() {
  return `sts${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** CRUD + reorder panel for STS cranes along the quay. */
export default function StsManager({ cranes, setCranes, selectedId, setSelectedId }) {
  const { t } = useI18n();
  const sorted = [...(cranes || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const renumber = (list) => list.map((c, i) => ({ ...c, order: i + 1 }));

  const addCrane = () => {
    const id = uid();
    const next = renumber([
      ...sorted,
      {
        id,
        name: `STS-${String(sorted.length + 1).padStart(2, '0')}`,
        mph: 28,
        order: sorted.length + 1,
      },
    ]);
    setCranes(next);
    setSelectedId?.(id);
  };

  const update = (id, patch) => {
    setCranes(cranes.map((c) => (c.id === id ? { ...c, ...patch } : c)));
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
    <div className="sts-manager">
      <div className="block-fields-head">
        <span className="toolbar-label">{t('sts.title')}</span>
        <button type="button" className="btn" onClick={addCrane}>
          {t('sts.add')}
        </button>
      </div>
      <p className="hint" style={{ margin: '0.25rem 0 0.55rem' }}>
        {t('sts.hint')}
      </p>
      {!sorted.length ? (
        <p className="hint">{t('sts.emptyHint')}</p>
      ) : (
        <div className="sts-table-wrap">
          <table className="data-table sts-table">
            <thead>
              <tr>
                <th>{t('sts.order')}</th>
                <th>{t('sts.name')}</th>
                <th>{t('sts.mph')}</th>
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
                    <button type="button" className="btn-ghost" onClick={() => move(c.id, -1)}>
                      ↑
                    </button>
                    <span>{c.order}</span>
                    <button type="button" className="btn-ghost" onClick={() => move(c.id, 1)}>
                      ↓
                    </button>
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
                    <button
                      type="button"
                      className="btn-ghost danger"
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
