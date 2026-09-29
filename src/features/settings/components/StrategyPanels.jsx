import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../../shared/i18n/I18nContext';
import { IconBarge } from '../../../shared/components/icons/PortIcons';
import { DAY_KEYS } from '../../berth-plan/utils/operations';
import ChartTip from '../../berth-plan/components/ChartTip';

function fmt(n, d = 0) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
}

function pct(n, d = 1) {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(d)}%`;
}

export function formatVnd(n) {
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('vi-VN')} ₫`;
}

function niceMax(v) {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

function LineChart({ labels, series, height = 180 }) {
  const w = 560;
  const h = height;
  const pad = { t: 16, r: 18, b: 36, l: 52 };
  const [hover, setHover] = useState(null);
  const max = niceMax(Math.max(...series.flatMap((s) => s.values), 0));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n = labels.length;
  const xAt = (i) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v) => pad.t + innerH - (v / max) * innerH;
  const step = n > 18 ? Math.ceil(n / 6) : n > 10 ? 2 : 1;

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * w;
    const rel = (x - pad.l) / Math.max(1, innerW);
    const index = Math.max(0, Math.min(n - 1, Math.round(rel * Math.max(0, n - 1))));
    setHover({
      index,
      x: event.clientX,
      y: event.clientY,
      title: labels[index] || `${index + 1}`,
      rows: series.map((ser) => ({
        label: ser.label || ser.id,
        color: ser.color,
        value: fmt(ser.values[index] || 0, (ser.values[index] || 0) >= 100 ? 0 : 1),
      })),
    });
  };

  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} className="area-chart-svg" role="img">
        {[0, 0.5, 1].map((tk) => {
          const y = pad.t + innerH * (1 - tk);
          return (
            <g key={tk}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} className="area-grid" />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" className="area-tick area-tick-y">
                {fmt(max * tk, max * tk >= 100 ? 0 : 1)}
              </text>
            </g>
          );
        })}
        {labels.map((lb, i) =>
          i % step === 0 || i === n - 1 ? (
            <text
              key={`${lb}-${i}`}
              x={xAt(i)}
              y={h - 8}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              className="area-tick area-tick-x"
            >
              {lb}
            </text>
          ) : null
        )}
        {series.map((ser) => {
          const d = ser.values
            .map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
            .join(' ');
          return (
            <path key={ser.id} d={d} fill="none" stroke={ser.color} strokeWidth="2" strokeLinejoin="round" />
          );
        })}
        {hover && (
          <line x1={xAt(hover.index)} x2={xAt(hover.index)} y1={pad.t} y2={h - pad.b} className="chart-guide" />
        )}
        <rect
          x={pad.l}
          y={pad.t}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      <ChartTip hover={hover} />
    </>
  );
}

function SpillBody({ spill, t }) {
  const call = spill.call;
  const vessel = call?.vesselName || call?.service || '—';
  const service = call?.service || '—';
  const berthName = spill.berth?.name || t('ops.noBerth');
  const vars = {
    bor: pct(spill.bor),
    alert: fmt(spill.thresholds.borAlertPct, 0),
    spill: fmt(spill.thresholds.borSpillPct, 0),
    wait: fmt(spill.thresholds.waitingTriggerHrs, 0),
    vessel,
    service,
    berth: berthName,
    hire: formatVnd(spill.hireVnd),
    penalty: formatVnd(spill.penaltyVnd),
  };
  if (spill.trigger) return t('ops.triggerBody', vars);
  if (spill.alert) return t('ops.alertBody', vars);
  return t('ops.clearBody', vars);
}

export function SpillBanner({ spill }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!spill) return null;
  const tone = spill.trigger ? 'hot' : spill.alert ? 'warm' : 'cool';
  const title = spill.trigger ? t('ops.triggerTitle') : spill.alert ? t('ops.alertTitle') : t('ops.clearTitle');

  return (
    <>
      <section className={`panel span-12 spill-banner tone-${tone}`}>
        <div>
          <h3>{title}</h3>
          <p>{SpillBody({ spill, t })}</p>
          <p className="hint">
            {t('ops.geometricWait')}: {fmt(spill.geometricWait, 1)} h · {t('ops.exposure')}:{' '}
            {fmt(spill.exposureHours, 1)} h
          </p>
        </div>
        <div className="spill-actions">
          {(spill.trigger || spill.alert) && (
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              {t('ops.openSuggestion')}
            </button>
          )}
          <Link className="chip" to="/secondary">
            {t('ops.goExternal')}
          </Link>
        </div>
      </section>
      {open && (
        <div className="modal-back" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="panel spill-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('ops.triggerTitle')}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{t('ops.triggerTitle')}</h3>
            <p>{SpillBody({ spill, t })}</p>
            <dl className="spill-facts">
              <div>
                <dt>{t('ops.hire')}</dt>
                <dd>{formatVnd(spill.hireVnd)}</dd>
              </div>
              <div>
                <dt>{t('ops.penalty')}</dt>
                <dd>{formatVnd(spill.penaltyVnd)}</dd>
              </div>
              <div>
                <dt>{t('ops.net')}</dt>
                <dd>{formatVnd(spill.netVnd)}</dd>
              </div>
            </dl>
            <div className="spill-actions">
              <Link className="btn" to="/secondary" onClick={() => setOpen(false)}>
                {t('ops.goExternal')}
              </Link>
              <button type="button" className="chip" onClick={() => setOpen(false)}>
                {t('ops.dismiss')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Heatmap({ heatmap }) {
  const { t } = useI18n();
  const [hover, setHover] = useState(null);
  const weeks = useMemo(() => {
    const map = new Map();
    for (const cell of heatmap?.cells || []) {
      if (!map.has(cell.week)) map.set(cell.week, []);
      map.get(cell.week).push(cell);
    }
    return [...map.entries()];
  }, [heatmap]);

  return (
    <section className="panel span-12">
      <h3>{t('ops.heatmapTitle')}</h3>
      <p className="hint">{t('ops.heatmapHint')}</p>
      <div className="heat-legend">
        <span className="heat-swatch cool">{t('ops.heatCool')}: {heatmap?.cool ?? 0}</span>
        <span className="heat-swatch warm">{t('ops.heatWarm')}: {heatmap?.warm ?? 0}</span>
        <span className="heat-swatch hot">{t('ops.heatHot')}: {heatmap?.hot ?? 0}</span>
      </div>
      <div className="heat-wrap touch-scroll">
        <div className="heat-grid">
          <span />
          {DAY_KEYS.map((d) => (
            <span key={d} className="heat-head">
              {t(`days.${d}`)}
            </span>
          ))}
          {weeks.map(([week, cells]) => (
            <React.Fragment key={week}>
              <span className="heat-week">{t('ops.heatmapWeek', { n: week })}</span>
              {cells.map((c) => (
                <span
                  key={`${week}-${c.day}`}
                  className={`heat-cell ${c.band}`}
                  onMouseMove={(event) =>
                    setHover({
                      x: event.clientX,
                      y: event.clientY,
                      title: `${t('ops.heatmapWeek', { n: week })} · ${t(`daysFull.${c.day}`)}`,
                      rows: [{ label: 'BOR', color: c.band === 'hot' ? '#ef4444' : c.band === 'warm' ? '#f59e0b' : '#14b8a6', value: pct(c.bor) }],
                    })
                  }
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      <ChartTip hover={hover} />
    </section>
  );
}

export function ErosionChart({ erosion }) {
  const { t } = useI18n();
  if (!erosion) return null;
  const rows = [
    { id: 'design', label: t('ops.design'), value: erosion.design, color: '#64748b' },
    { id: 'maint', label: t('ops.maintenance'), value: erosion.maintenance, color: '#334155' },
    { id: 'break', label: t('ops.breakdown'), value: erosion.breakdown, color: '#b45309' },
    { id: 'net', label: t('ops.netAvailable'), value: erosion.net, color: '#0f766e' },
    { id: 'used', label: t('ops.used'), value: erosion.used, color: '#0369a1' },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <section className="panel span-6">
      <h3>{t('ops.erosionTitle')}</h3>
      <p className="hint">{t('ops.erosionHint')}</p>
      <div className="chart-compare">
        {rows.map((r) => (
          <div key={r.id} className="chart-compare-row">
            <div className="chart-compare-label">
              <strong>{r.label}</strong>
              <span>{fmt(r.value, 0)} MH</span>
            </div>
            <div className="chart-compare-bars">
              <div className="chart-compare-track">
                <div
                  className="chart-compare-fill expected"
                  style={{ width: `${(r.value / max) * 100}%`, background: r.color }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="hint">
        {t('ops.erosionPct')}: {pct(erosion.erosionPct)}
      </p>
    </section>
  );
}

export function BargeCalculator({ berth, ops }) {
  const { t } = useI18n();
  const fit = ops?.bargeFit;
  const maxDay = Math.max(...(fit?.byDay || []).map((d) => d.calls), 1);
  return (
    <section className="panel span-6">
      <h3 className="icon-label">
        <IconBarge size={18} />
        {t('ops.bargeTitle')}
      </h3>
      <p className="hint">{t('ops.bargeHint')}</p>
      <div className="dash-metric-list">
        <div>
          <span>{t('ops.bargeDemand')}</span>
          <strong>{fmt(berth?.barge?.callsPerWeek, 0)}</strong>
        </div>
        <div>
          <span>{t('ops.bargeFit')}</span>
          <strong>{fmt(fit?.callsPerWeek, 0)}</strong>
        </div>
        <div>
          <span>{t('ops.bargeGap')}</span>
          <strong>{fmt(ops?.bargeWindows?.length, 0)}</strong>
        </div>
        <div>
          <span>{t('ops.bargeMh')}</span>
          <strong>{fmt(berth?.bargeMeterHours, 0)}</strong>
        </div>
      </div>
      <p className="hint">{t('ops.byDay')}</p>
      <div className="barge-days">
        {(fit?.byDay || []).map((d) => (
          <div key={d.key} className="barge-day">
            <span>{t(`days.${d.key}`)}</span>
            <div className="chart-compare-track">
              <div
                className="chart-compare-fill expected"
                style={{ width: `${(d.calls / maxDay) * 100}%`, background: '#ea580c' }}
              />
            </div>
            <strong>{fmt(d.calls, 0)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrendSection({ ops }) {
  const { t } = useI18n();
  const lines = ops?.serviceTrends || [];
  const [code, setCode] = useState(lines[0]?.service || '');
  const selected = lines.find((l) => l.service === code) || lines[0];
  const speed = ops?.speedTrend;
  const punct = ops?.punctuality;

  return (
    <>
      <section className="panel span-12">
        <h3>{t('ops.trendTitle')}</h3>
        <p className="hint">{t('ops.trendHint')}</p>
        <p className="hint">{t('ops.scenarioNote')}</p>
        <div className="scale-toggle compact wrap trend-picker">
          {lines.map((l) => (
            <button
              key={l.service}
              type="button"
              className={`chip ${selected?.service === l.service ? 'active' : ''}`}
              onClick={() => setCode(l.service)}
            >
              {l.service}
            </button>
          ))}
        </div>
        {selected && (
          <>
            <p className="hint">
              {t('ops.delta')}: {t('ops.volume')} {pct(selected.volumeDelta)} · {t('ops.portstay')}{' '}
              {pct(selected.portstayDelta)}
            </p>
            <div className="area-chart-grid">
              <div className="area-chart-card">
                <h4 className="area-chart-title">{t('ops.volume')}</h4>
                <LineChart
                  labels={selected.points.map((p) => p.label)}
                  series={[
                    {
                      id: 'vol',
                      label: t('ops.volume'),
                      color: '#0e7490',
                      values: selected.points.map((p) => p.volume),
                    },
                  ]}
                />
              </div>
              <div className="area-chart-card">
                <h4 className="area-chart-title">{t('ops.portstay')}</h4>
                <LineChart
                  labels={selected.points.map((p) => p.label)}
                  series={[{ id: 'stay', label: t('ops.portstay'), color: '#b45309', values: selected.points.map((p) => p.portstay) }]}
                />
              </div>
            </div>
          </>
        )}
      </section>

      <section className="panel span-6">
        <h3>{t('ops.speedTitle')}</h3>
        <p className="hint">{t('ops.speedHint')}</p>
        {speed && (
          <>
            <p className="hint">
              CMPH {pct(speed.cmphDelta)} · PMPH {pct(speed.pmphDelta)}
            </p>
            <div className="area-chart-card">
              <LineChart
                labels={speed.points.map((p) => p.label)}
                series={[
                  {
                    id: 'cmph',
                    label: t('ops.cmph'),
                    color: '#0369a1',
                    values: speed.points.map((p) => p.cmph),
                  },
                  {
                    id: 'pmph',
                    label: t('ops.pmph'),
                    color: '#0f766e',
                    values: speed.points.map((p) => p.pmph),
                  },
                ]}
              />
              <ul className="area-legend">
                <li>
                  <span className="swatch" style={{ background: '#0369a1' }} />
                  <div>
                    <strong>{t('ops.cmph')}</strong>
                  </div>
                </li>
                <li>
                  <span className="swatch" style={{ background: '#0f766e' }} />
                  <div>
                    <strong>{t('ops.pmph')}</strong>
                  </div>
                </li>
              </ul>
            </div>
          </>
        )}
      </section>

      <section className="panel span-6">
        <h3>{t('ops.punctualTitle')}</h3>
        <p className="hint">{t('ops.punctualHint')}</p>
        {punct && (
          <>
            <p className="hint">
              {t('ops.buffer')}: {fmt(punct.recommendedBufferHrs, 1)} h
            </p>
            <div className="area-chart-card">
              <h4 className="area-chart-title">{t('ops.lateRate')}</h4>
              <LineChart
                labels={punct.quarters.map((q) => q.label)}
                series={[
                  {
                    id: 'late',
                    label: t('ops.lateRate'),
                    color: '#b91c1c',
                    values: punct.quarters.map((q) => q.lateRate * 100),
                  },
                ]}
              />
            </div>
            <div className="table-wrap touch-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('capacity.th.service')}</th>
                    <th>{t('ops.lateRate')}</th>
                    <th>{t('ops.buffer')}</th>
                  </tr>
                </thead>
                <tbody>
                  {punct.byService.map((row) => (
                    <tr key={row.service}>
                      <td>{row.service}</td>
                      <td>{pct(row.lateRate)}</td>
                      <td>{fmt(row.bufferHrs, 1)} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

export default function StrategyPanels({ berth, ops }) {
  return (
    <>
      <SpillBanner spill={ops?.spill} />
      <Heatmap heatmap={ops?.heatmap} />
      <ErosionChart erosion={ops?.erosion} />
      <BargeCalculator berth={berth} ops={ops} />
      <TrendSection ops={ops} />
    </>
  );
}
