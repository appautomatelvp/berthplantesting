import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { formatVnd, SpillBanner } from '../components/StrategyPanels';
import QuayLengthInput from '../components/QuayLengthInput';
import CraneRail from '../components/CraneRail';
import CraneManager from '../components/CraneManager';
import PageToolbar from '../components/PageToolbar';
import { DEFAULT_UI, TIME_SCALES, meterToLeftPercent, buildMeterMarks, METER_DIRECTIONS, berthScaleOf, reportPeriodOf } from '../lib/uiSettings';
import { clampCranePosition } from '../lib/crane';
import { calcBerthCapacity } from '../lib/capacity';
import { buildOperations } from '../lib/operations';

/**
 * Secondary berth — independent name, quay length, and crane set.
 * Shares UI language with the main berth plan only.
 */
export default function SecondaryBerth({ model }) {
  const { t } = useI18n();
  const { secondaryBerth, setSecondaryBerth, externalBerths, setExternalBerths, ui, setUi, moveSecondaryCrane, terminal, metrics, services, lockZones } = model;
  const [toolsPanel, setToolsPanel] = useState(null);
  const [selectedCraneId, setSelectedCraneId] = useState(null);
  const scaleId = berthScaleOf(ui?.horizon || ui?.timeScale || DEFAULT_UI.timeScale);
  const meterDirection = ui?.secondaryMeterDirection || ui?.meterDirection || DEFAULT_UI.meterDirection;
  const quay = Math.max(50, Number(secondaryBerth.quayLength) || 400);
  const marks = buildMeterMarks(quay);
  const dayBands = 7;
  const rowH = 48;
  const chartH = dayBands * 12 * rowH;
  const toolsOpen = toolsPanel != null;

  const openToolsPanel = useCallback((panel) => {
    setToolsPanel((cur) => (cur === panel ? null : panel));
  }, []);

  const closeDrawer = useCallback(() => setToolsPanel(null), []);

  useEffect(() => {
    if (!toolsPanel) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toolsPanel, closeDrawer]);

  const patchBerth = useCallback(
    (patch) => setSecondaryBerth({ ...secondaryBerth, ...patch }),
    [secondaryBerth, setSecondaryBerth]
  );

  const setCranes = useCallback(
    (next) => {
      const list = typeof next === 'function' ? next(secondaryBerth.cranes) : next;
      patchBerth({ cranes: list });
    },
    [secondaryBerth.cranes, patchBerth]
  );

  const spill = useMemo(() => {
    const berth = calcBerthCapacity({ services, terminal, metrics, lockZones });
    return buildOperations({
      services,
      terminal,
      metrics,
      lockZones,
      berth,
      externalBerths,
      period: reportPeriodOf(ui?.horizon || ui?.timeScale || 'week'),
    }).spill;
  }, [services, terminal, metrics, lockZones, externalBerths, ui]);

  const patchExternal = (id, patch) => {
    setExternalBerths((list) => list.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <div className={`plan-shell ${toolsOpen ? 'drawer-open' : ''}`}>
      <PageToolbar>
        <button
          type="button"
          className="chip"
          data-tip={t('tip.jump')}
          onClick={() => document.getElementById('ext-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {t('ops.catalogTitle')}
        </button>
        <button
          type="button"
          className={`chip ${toolsPanel === 'view' ? 'active' : ''}`}
          data-tip={t('tip.view')}
          onClick={() => openToolsPanel('view')}
        >
          {t('window.toolGroup.view')}
        </button>
        <button
          type="button"
          className={`chip ${toolsPanel === 'cranes' ? 'active' : ''}`}
          data-tip={t('tip.cranes')}
          onClick={() => openToolsPanel('cranes')}
        >
          {t('window.toolGroup.cranes')}
        </button>
      </PageToolbar>
      <header className="plan-topbar">
        <div className="plan-topbar-main">
          <div className="live-kpis compact">
            <div>
              <span>{t('window.quayAxis')}</span>
              <strong>{quay} m</strong>
            </div>
            <div>
              <span>{t('crane.title')}</span>
              <strong>{secondaryBerth.cranes?.length || 0}</strong>
            </div>
          </div>
        </div>
      </header>

      <section className="external-board">
        <SpillBanner spill={spill} />
        <div className="panel" id="ext-catalog">
          <h3>{t('ops.catalogTitle')}</h3>
          <p className="hint">{t('ops.catalogHint')}</p>
          <div className="table-wrap touch-scroll">
            <table className="data-table external-table">
              <thead>
                <tr>
                  <th>{t('secondary.berthName')}</th>
                  <th>{t('ops.partner')}</th>
                  <th>{t('ops.draft')}</th>
                  <th>{t('ops.maxLoa')}</th>
                  <th>{t('ops.tow')}</th>
                  <th>{t('ops.hireCall')}</th>
                </tr>
              </thead>
              <tbody>
                {(externalBerths || []).map((row) => {
                  const suggested = spill?.berth?.id === row.id;
                  return (
                    <tr key={row.id} className={suggested ? 'suggested-row' : ''}>
                      <td>
                        <input value={row.name} onChange={(e) => patchExternal(row.id, { name: e.target.value })} />
                        {suggested ? <em className="suggest-tag">{t('ops.selected')}</em> : null}
                      </td>
                      <td>
                        <input value={row.partner || ''} onChange={(e) => patchExternal(row.id, { partner: e.target.value })} />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.draftM}
                          onChange={(e) => patchExternal(row.id, { draftM: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.maxLoa}
                          onChange={(e) => patchExternal(row.id, { maxLoa: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.towNm}
                          onChange={(e) => patchExternal(row.id, { towNm: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.hireVnd}
                          onChange={(e) => patchExternal(row.id, { hireVnd: Number(e.target.value) })}
                        />
                        <span className="unit">{formatVnd(row.hireVnd)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="plan-workbench">
      <div className="plan-stage">
        <div className="window-scroll plan-chart-full">
          <div className="window-chart secondary-chart has-crane-rail" style={{ height: chartH + 36 + 64 }}>
            <div className="window-meters">
              {marks.map((m) => (
                <span key={m} style={{ left: `${meterToLeftPercent(m, quay, meterDirection)}%` }}>
                  {m}m
                </span>
              ))}
            </div>
            <CraneRail
              cranes={secondaryBerth.cranes || []}
              quayLength={quay}
              meterDirection={meterDirection}
              selectedId={selectedCraneId}
              onSelect={setSelectedCraneId}
              onEdit={(id) => {
                setSelectedCraneId(id);
                setToolsPanel('cranes');
              }}
              onMove={moveSecondaryCrane}
            />
            <div className="window-body continuous secondary-body" style={{ height: chartH }}>
              <div className="secondary-placeholder">
                <h3>{t('secondary.placeholderTitle')}</h3>
                <p>{t('secondary.placeholderBody')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toolsOpen && (
          <aside className="plan-editor-drawer panel" role="dialog" aria-label={t('window.tools')}>
            {toolsPanel === 'view' && (
              <div className="tool-group-body">
                <div className="drawer-head">
                  <h2>{t('window.toolGroup.view')}</h2>
                  <button type="button" className="btn-ghost" onClick={closeDrawer}>
                    {t('window.closeEditor')} ✕
                  </button>
                </div>
                <div className="toolbar-controls stack">
                  <div className="toolbar-group">
                    <span className="toolbar-label">{t('secondary.berthName')}</span>
                    <input
                      className="quay-inline"
                      value={secondaryBerth.name}
                      onChange={(e) => patchBerth({ name: e.target.value })}
                    />
                  </div>
                  <div className="toolbar-group">
                    <span className="toolbar-label">{t('secondary.quayLength')}</span>
                    <div className="toolbar-inline-row">
                      <QuayLengthInput
                        value={secondaryBerth.quayLength}
                        onCommit={(v) => {
                          const cranes = (secondaryBerth.cranes || []).map((c) => ({
                            ...c,
                            positionM: clampCranePosition(c.positionM ?? 0, v),
                          }));
                          patchBerth({ quayLength: v, cranes });
                        }}
                      />
                      <span className="unit">m</span>
                    </div>
                  </div>
                  <div className="toolbar-group">
                    <span className="toolbar-label">{t('settings.meterDirection')}</span>
                    <div className="scale-toggle compact">
                      {METER_DIRECTIONS.map((dir) => (
                        <button
                          key={dir}
                          type="button"
                          className={`chip ${meterDirection === dir ? 'active' : ''}`}
                          onClick={() => setUi({ ...ui, secondaryMeterDirection: dir })}
                        >
                          {dir === 'ltr' ? '0→L' : 'L→0'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="toolbar-group">
                    <span className="toolbar-label">{t('window.viewMode')}</span>
                    <div className="scale-toggle compact wrap">
                      {Object.keys(TIME_SCALES).map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={`chip ${scaleId === id ? 'active' : ''}`}
                          onClick={() => setUi({ ...ui, secondaryTimeScale: id })}
                        >
                          {t(`timeScale.${id}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="hint" style={{ margin: '0.75rem 0 0' }}>
                  {t('secondary.toolsHint')}
                </p>
              </div>
            )}
            {toolsPanel === 'cranes' && (
              <div className="tool-group-body">
                <div className="drawer-head">
                  <h2>{t('window.toolGroup.cranes')}</h2>
                  <button type="button" className="btn-ghost" onClick={closeDrawer}>
                    {t('window.closeEditor')} ✕
                  </button>
                </div>
                <CraneManager
                  cranes={secondaryBerth.cranes || []}
                  setCranes={setCranes}
                  selectedId={selectedCraneId}
                  setSelectedId={setSelectedCraneId}
                  quayLength={quay}
                />
              </div>
            )}
          </aside>
      )}
      </div>

      <footer className="plan-statusbar">
        <span>{t('secondary.statusBar')}</span>
      </footer>
    </div>
  );
}
