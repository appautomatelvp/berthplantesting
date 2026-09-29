import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext';
import QuayLengthInput from '../components/QuayLengthInput';
import { clampCranePosition } from '../../berth-plan/utils/crane';
import { calcBerthCapacity, classifyBor } from '../../capacity/utils/index';
import { BOR_BANDS } from '../../../shared/utils/seed';
import { DEFAULT_UI, HORIZONS, METER_DIRECTIONS, QUAY_PRESETS, editorShifts, shiftsOf, withHorizon } from '../../../shared/utils/uiSettings';
import PageToolbar from '../../../shared/components/PageToolbar';
import ParameterExcel from '../../../shared/components/ParameterExcel';

const SECTION_IDS = [
  'settings-geometry',
  'settings-display',
  'settings-language',
  'settings-bor',
];

/**
 * System & calibration hub.
 * All parameter sections stay visible; top tabs are sticky jump links (never hide content).
 */
export default function Settings({ model }) {
  const { t, locale, setLocale } = useI18n();
  const { terminal, setTerminal, metrics, services, lockZones, ui, setUi, setCranes } = model;
  const horizon = ui?.horizon || ui?.timeScale || DEFAULT_UI.horizon;
  const meterDirection = ui?.meterDirection || DEFAULT_UI.meterDirection;
  const L = terminal.quayLength;
  const leftLabel = meterDirection === 'ltr' ? '0m' : `${L}m`;
  const rightLabel = meterDirection === 'ltr' ? `${L}m` : '0m';
  const [activeSection, setActiveSection] = useState(SECTION_IDS[0]);

  const berth = useMemo(
    () => calcBerthCapacity({ services, terminal, metrics, lockZones }),
    [services, terminal, metrics, lockZones]
  );
  const current = classifyBor(berth.berthUtilization, BOR_BANDS);
  const buPct = berth.berthUtilization * 100;

  const tabs = useMemo(
    () => [
      { id: 'settings-geometry', label: t('settings.jump.geometry') },
      { id: 'settings-display', label: t('settings.jump.display') },
      { id: 'settings-language', label: t('settings.jump.language') },
      { id: 'settings-bor', label: t('settings.jump.bor') },
    ],
    [t]
  );

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActiveSection(id);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      window.history.replaceState(null, '', `#${id}`);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const id = window.location.hash?.replace(/^#/, '');
    if (id && SECTION_IDS.includes(id)) {
      requestAnimationFrame(() => scrollToSection(id));
    }
  }, [scrollToSection]);

  useEffect(() => {
    const nodes = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
    if (!nodes.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActiveSection(visible[0].target.id);
      },
      { root: null, rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] }
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="settings-page">
      <PageToolbar>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`chip ${activeSection === tab.id ? 'active' : ''}`}
            aria-current={activeSection === tab.id ? 'true' : undefined}
            data-tip={t('tip.jump')}
            onClick={() => scrollToSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </PageToolbar>
      <header className="settings-sticky-head">
        <div className="settings-sticky-copy">
          <h2>{t('settings.title')}</h2>
          <p className="hint">{t('settings.subtitle')}</p>
        </div>
      </header>

      <div className="page-grid settings-body">
        <section id="settings-excel" className="panel span-12">
          <h2>{t('excel.title')}</h2>
          <p className="hint">{t('excel.hint')}</p>
          <ParameterExcel model={model} variant="panel" />
        </section>
        <section id="settings-geometry" className="panel span-6">
          <h2>{t('settings.quayTitle')}</h2>
          <p className="hint">{t('settings.quayHint')}</p>
          <div className="aligned-fields">
            <label className="aligned-row">
              <span>{t('capacity.name')}</span>
              <input
                value={terminal.name}
                onChange={(e) => setTerminal({ ...terminal, name: e.target.value })}
              />
            </label>
            <label className="aligned-row">
              <span>{t('settings.quayLength')}</span>
              <QuayLengthInput
                value={terminal.quayLength}
                onCommit={(v) => {
                  setTerminal({ ...terminal, quayLength: v });
                  setCranes?.((list) =>
                    list.map((c) => ({
                      ...c,
                      positionM: clampCranePosition(c.positionM ?? 0, v),
                    }))
                  );
                }}
                className=""
              />
            </label>
            <label className="aligned-row">
              <span>{t('capacity.workingDaysYear')}</span>
              <input
                type="number"
                value={terminal.workingDaysPerYear}
                onChange={(e) =>
                  setTerminal({ ...terminal, workingDaysPerYear: Number(e.target.value) })
                }
              />
            </label>
            <label className="aligned-row">
              <span>{t('capacity.workingHoursDay')}</span>
              <input
                type="number"
                value={terminal.workingHoursPerDay}
                onChange={(e) =>
                  setTerminal({ ...terminal, workingHoursPerDay: Number(e.target.value) })
                }
              />
            </label>
            <label className="aligned-row">
              <span>{t('capacity.weeksYear')}</span>
              <input
                type="number"
                value={terminal.workingWeeksPerYear}
                onChange={(e) =>
                  setTerminal({ ...terminal, workingWeeksPerYear: Number(e.target.value) })
                }
              />
            </label>
            <label className="aligned-row">
              <span>{t('capacity.daysWeek')}</span>
              <input
                type="number"
                value={terminal.workingDaysPerWeek}
                onChange={(e) =>
                  setTerminal({ ...terminal, workingDaysPerWeek: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="preset-row">
            <span className="preset-label">{t('settings.quayPresets')}</span>
            <div className="preset-btns">
              {QUAY_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`chip ${terminal.quayLength === m ? 'active' : ''}`}
                  onClick={() => setTerminal({ ...terminal, quayLength: m })}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          <div className="preset-row">
            <span className="preset-label">{t('settings.meterDirection')}</span>
            <p className="hint" style={{ marginBottom: '0.5rem' }}>
              {t('settings.meterDirectionHint')}
            </p>
            <div className="scale-toggle">
              {METER_DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  className={`chip ${meterDirection === dir ? 'active' : ''}`}
                  onClick={() => setUi({ ...ui, meterDirection: dir })}
                >
                  {dir === 'ltr' ? t('settings.meterLtr') : t('settings.meterRtl')}
                </button>
              ))}
            </div>
          </div>

          <div className="quay-preview">
            <div className="quay-preview-labels">
              <span>
                {t('settings.meterPreviewLeft')}: <strong>{leftLabel}</strong>
              </span>
              <span>
                {t('settings.meterPreviewRight')}: <strong>{rightLabel}</strong>
              </span>
            </div>
            <div className={`quay-preview-bar ${meterDirection}`}>
              <span>{leftLabel}</span>
              <div className="quay-preview-fill" />
              <span>{rightLabel}</span>
            </div>
          </div>
        </section>

        <section id="settings-display" className="panel span-6">
          <h2>{t('settings.displayTitle')}</h2>
          <p className="hint">{t('timeScale.hint')}</p>
          <label>
            {t('settings.defaultScale')}
            <div className="scale-toggle">
              {HORIZONS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`chip ${horizon === id ? 'active' : ''}`}
                  onClick={() => setUi(withHorizon(ui, id))}
                >
                  {t(`horizon.${id}`)}
                </button>
              ))}
            </div>
          </label>
          <p className="hint" style={{ marginTop: '1rem' }}>
            {t('settings.saved')}
          </p>
          <h3 className="shift-settings-title">{t('settings.shiftTitle')}</h3>
          <p className="hint">{t('settings.shiftHint')}</p>
          <div className="shift-editor">
            {editorShifts(ui).map((row, index, list) => (
              <div key={row.id} className="shift-editor-row">
                <input
                  type="text"
                  value={row.name}
                  aria-label={t('settings.shiftName')}
                  onChange={(e) => {
                    const next = list.map((item, i) => (i === index ? { ...item, name: e.target.value } : item));
                    setUi({ ...ui, shifts: next, shiftHandoverA: next[0]?.start || '', shiftHandoverB: next[1]?.start || '' });
                  }}
                />
                <input
                  type="time"
                  aria-label={t('settings.shiftStart')}
                  value={row.start}
                  onChange={(e) => {
                    const next = list.map((item, i) => (i === index ? { ...item, start: e.target.value } : item));
                    setUi({ ...ui, shifts: next, shiftHandoverA: next[0]?.start || '', shiftHandoverB: next[1]?.start || '' });
                  }}
                />
                <input
                  type="time"
                  aria-label={t('settings.shiftEnd')}
                  value={row.end}
                  onChange={(e) => {
                    const next = list.map((item, i) => (i === index ? { ...item, end: e.target.value } : item));
                    setUi({ ...ui, shifts: next });
                  }}
                />
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={list.length < 2}
                  onClick={() => {
                    const next = list.filter((_, i) => i !== index);
                    setUi({ ...ui, shifts: next, shiftHandoverA: next[0]?.start || '', shiftHandoverB: next[1]?.start || '' });
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn"
              onClick={() => {
                const list = editorShifts(ui);
                const next = [
                  ...list,
                  { id: `shift${Date.now().toString(36)}`, name: `${t('settings.shiftName')} ${list.length + 1}`, start: '00:00', end: '08:00' },
                ];
                setUi({ ...ui, shifts: next });
              }}
            >
              {t('settings.addShift')}
            </button>
          </div>
        </section>

        <section id="settings-language" className="panel span-6">
          <h2>{t('settings.languageTitle')}</h2>
          <p className="hint">{t('settings.languageHint')}</p>
          <div className="scale-toggle">
            <button
              type="button"
              className={`chip ${locale === 'vi' ? 'active' : ''}`}
              onClick={() => setLocale('vi')}
            >
              {t('lang.vi')}
            </button>
            <button
              type="button"
              className={`chip ${locale === 'en' ? 'active' : ''}`}
              onClick={() => setLocale('en')}
            >
              {t('lang.en')}
            </button>
          </div>
        </section>

        <section id="settings-bor" className="panel span-12">
          <h2>{t('benchmarks.title')}</h2>
          <p className="hint">
            {t('benchmarks.hint', {
              quay: terminal.quayLength,
              bu: buPct.toFixed(1),
              label: current ? t(`bor.${current.id}.label`) : '—',
            })}
          </p>
          <div className="bor-meter">
            <div className="bor-fill" style={{ width: `${Math.min(100, buPct)}%` }} />
            <div className="bor-needle" style={{ left: `${Math.min(100, buPct)}%` }} />
            {[50, 60, 65, 70, 75].map((tick) => (
              <div key={tick} className="bor-tick" style={{ left: `${tick}%` }} data-label={`${tick}%`} />
            ))}
          </div>
          <div className="bor-table">
            {BOR_BANDS.map((b) => (
              <article key={b.id} className={`bor-row ${current?.id === b.id ? 'active' : ''}`}>
                <div className="bor-range">
                  {b.maxPct >= 999 ? `> ${b.minPct}%` : `${b.minPct}% – ${b.maxPct}%`}
                </div>
                <div className="bor-label">{t(`bor.${b.id}.label`)}</div>
                <div className="bor-impact">{t(`bor.${b.id}.impact`)}</div>
                <div className="bor-mitigation">{t(`bor.${b.id}.mitigation`)}</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
