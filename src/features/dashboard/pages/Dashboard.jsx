import React, { useId, useMemo, useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext';
import ChartTip from '../../berth-plan/components/ChartTip';
import { buildDashboard, sortedCalls } from '../utils/dashboard';
import { buildOperations } from '../../berth-plan/utils/operations';
import StrategyPanels from '../../settings/components/StrategyPanels';
import { classifyBor } from '../../capacity/utils/index';
import { reportPeriodOf } from '../../../shared/utils/uiSettings';
import { BOR_BANDS } from '../../../shared/utils/seed';
import { buildServiceColorMap } from '../../berth-plan/utils/serviceColor';

function fmt(n, d = 0) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
}

function pct(n, d = 1) {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(d)}%`;
}

const TIER_COLORS = {
  large: '#0f766e',
  medium: '#0369a1',
  small: '#64748b',
};

const METRIC_COLORS = {
  proforma: '#94a3b8',
  expected: '#0e7490',
  mh: '#0369a1',
  concurrent: '#b45309',
};
function niceMax(v) {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

/** Build SVG area / line path from values (0..n-1). */
function seriesToPoints(values, w, h, pad = { t: 12, r: 12, b: 28, l: 40 }) {
  const n = values.length;
  const max = niceMax(Math.max(...values, 0));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const pts = values.map((v, i) => {
    const x = pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = pad.t + innerH - (v / max) * innerH;
    return [x, y];
  });
  return { pts, max, pad, innerW, innerH };
}

function linePath(pts) {
  if (!pts.length) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

function areaPath(pts, baselineY) {
  if (!pts.length) return '';
  const head = linePath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${head} L${last[0].toFixed(1)},${baselineY} L${first[0].toFixed(1)},${baselineY} Z`;
}

/** Stacked area: each series is absolute top edge after stacking. */
function stackedAreas(seriesList, w, h, pad = { t: 12, r: 12, b: 28, l: 40 }) {
  const n = seriesList[0]?.values.length || 0;
  const totals = Array.from({ length: n }, (_, i) =>
    seriesList.reduce((s, ser) => s + (ser.values[i] || 0), 0)
  );
  const max = niceMax(Math.max(...totals, 0));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const baseline = pad.t + innerH;
  let cumulative = Array(n).fill(0);
  const layers = seriesList.map((ser) => {
    const top = ser.values.map((v, i) => {
      cumulative[i] += v || 0;
      return cumulative[i];
    });
    const bottom = top.map((v, i) => v - (ser.values[i] || 0));
    const topPts = top.map((v, i) => {
      const x = pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const y = pad.t + innerH - (v / max) * innerH;
      return [x, y];
    });
    const botPts = bottom.map((v, i) => {
      const x = pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const y = pad.t + innerH - (v / max) * innerH;
      return [x, y];
    });
    const path = [
      ...topPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`),
      ...[...botPts].reverse().map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`),
      'Z',
    ].join(' ');
    return { ...ser, path, topPts };
  });
  return { layers, max, pad, baseline, innerW, innerH };
}

function AxisLabels({ labels, pad, w, h, max }) {
  const nonempty = labels.filter(Boolean).length;
  const step = nonempty > 16 ? Math.ceil(labels.length / 8) : 1;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const yTicks = [0, 0.5, 1].map((t) => ({
    y: pad.t + innerH * (1 - t),
    v: max * t,
  }));
  return (
    <g className="area-axis">
      {yTicks.map((tk) => (
        <g key={tk.v}>
          <line
            x1={pad.l}
            x2={w - pad.r}
            y1={tk.y}
            y2={tk.y}
            className="area-grid"
          />
          <text x={pad.l - 8} y={tk.y + 4} textAnchor="end" className="area-tick area-tick-y">
            {fmt(tk.v, tk.v >= 1000 ? 0 : 1)}
          </text>
        </g>
      ))}
      {labels.map((lb, i) => {
        if (!lb) return null;
        if (step > 1 && i % step !== 0 && i !== labels.length - 1) return null;
        const x = pad.l + (labels.length <= 1 ? innerW / 2 : (i / Math.max(1, labels.length - 1)) * innerW);
        const anchor = i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle';
        return (
          <text key={`${lb}-${i}`} x={x} y={h - 10} textAnchor={anchor} className="area-tick area-tick-x">
            {lb}
          </text>
        );
      })}
    </g>
  );
}

/** Multi-series area chart (overlay or single). */
function AreaChart({
  title,
  hint,
  labels,
  tipLabels,
  series,
  height = 200,
  stacked = false,
}) {
  const uid = useId().replace(/:/g, '');
  const w = 560;
  const h = height;
  const pad = { t: 22, r: 18, b: 40, l: 72 };
  const [hover, setHover] = useState(null);
  const tipAt = (index) => {
    const title = (tipLabels && tipLabels[index]) || labels[index] || `${index + 1}`;
    const rows = series.map((ser) => ({
      label: ser.label,
      color: ser.color,
      value: fmt(ser.values[index] || 0, (ser.values[index] || 0) >= 100 ? 0 : 1),
    }));
    if (stacked && rows.length > 1) {
      const total = series.reduce((sum, ser) => sum + (ser.values[index] || 0), 0);
      rows.push({ label: 'Σ', color: '#e2e8f0', value: fmt(total, 0) });
    }
    return { title, rows };
  };

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * w;
    const innerW = w - pad.l - pad.r;
    const rel = (x - pad.l) / Math.max(1, innerW);
    const index = Math.max(0, Math.min(labels.length - 1, Math.round(rel * Math.max(0, labels.length - 1))));
    const detail = tipAt(index);
    setHover({
      index,
      x: event.clientX,
      y: event.clientY,
      title: detail.title,
      rows: detail.rows,
    });
  };

  const stackedData = stacked ? stackedAreas(series, w, h, pad) : null;
  const overlay = !stacked
    ? series.map((ser) => {
        const { pts, max } = seriesToPoints(ser.values, w, h, pad);
        return { ...ser, pts, max, baseline: pad.t + (h - pad.t - pad.b) };
      })
    : [];
  const max = stacked ? stackedData.max : Math.max(...overlay.map((s) => s.max), 1);

  return (
    <div className="area-chart-card">
      {title && <h4 className="area-chart-title">{title}</h4>}
      {hint && <p className="hint chart-caption">{hint}</p>}
      <svg viewBox={`0 0 ${w} ${h}`} className="area-chart-svg" role="img" aria-label={title || 'area chart'}>
        <defs>
          {series.map((ser) => (
            <linearGradient key={ser.id} id={`ag-${uid}-${ser.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ser.color} stopOpacity="0.55" />
              <stop offset="100%" stopColor={ser.color} stopOpacity="0.05" />
            </linearGradient>
          ))}
        </defs>
        <AxisLabels labels={labels} pad={pad} w={w} h={h} max={max} />
        {stacked
          ? stackedData.layers.map((layer) => (
              <path
                key={layer.id}
                d={layer.path}
                fill={`url(#ag-${uid}-${layer.id})`}
                stroke={layer.color}
                strokeWidth="1.5"
                className="area-fill"
              />
            ))
          : overlay.map((ser) => (
              <g key={ser.id}>
                <path
                  d={areaPath(ser.pts, ser.baseline)}
                  fill={`url(#ag-${uid}-${ser.id})`}
                  className="area-fill"
                />
                <path
                  d={linePath(ser.pts)}
                  fill="none"
                  stroke={ser.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            ))}
        {hover && (
          <line
            x1={pad.l + (labels.length <= 1 ? (w - pad.l - pad.r) / 2 : (hover.index / Math.max(1, labels.length - 1)) * (w - pad.l - pad.r))}
            x2={pad.l + (labels.length <= 1 ? (w - pad.l - pad.r) / 2 : (hover.index / Math.max(1, labels.length - 1)) * (w - pad.l - pad.r))}
            y1={pad.t}
            y2={h - pad.b}
            className="chart-guide"
          />
        )}
        <rect
          x={pad.l}
          y={pad.t}
          width={w - pad.l - pad.r}
          height={h - pad.t - pad.b}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      <ChartTip hover={hover} />
      <ul className="area-legend">
        {series.map((ser) => (
          <li key={ser.id}>
            <span className="swatch" style={{ background: ser.color }} />
            <div>
              <strong>{ser.label}</strong>
              {ser.detail ? <span>{ser.detail}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function arcPath(cx, cy, radius, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const point = (angle) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  const [x0, y0] = point(a0);
  const [x1, y1] = point(a1);
  return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
}

function TierDonut({ tiers, t }) {
  const [hover, setHover] = useState(null);
  const items = [
    { id: 'large', ...tiers.large },
    { id: 'medium', ...tiers.medium },
    { id: 'small', ...tiers.small },
  ].filter((x) => x.expectedMoves > 0);
  const total = items.reduce((s, x) => s + x.expectedMoves, 0) || 1;
  const r = 54;
  let angle = -Math.PI / 2;
  const slices = items.map((item) => {
    const sweep = (item.expectedMoves / total) * Math.PI * 2;
    const d = arcPath(70, 70, r, angle, angle + Math.max(sweep, 0.001));
    angle += sweep;
    return { item, d };
  });

  return (
    <div className="chart-donut-wrap">
      <svg viewBox="0 0 140 140" className="chart-donut" aria-hidden>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(30,58,85,0.8)" strokeWidth="16" />
        {slices.map(({ item, d }) => (
          <path
            key={item.id}
            d={d}
            fill="none"
            stroke={TIER_COLORS[item.id]}
            strokeWidth="16"
            onMouseMove={(event) =>
              setHover({
                x: event.clientX,
                y: event.clientY,
                title: t(`dashboard.tier.${item.id}`),
                rows: [
                  { label: 'Moves', color: TIER_COLORS[item.id], value: fmt(item.expectedMoves, 0) },
                  { label: '%', color: TIER_COLORS[item.id], value: pct(item.sharePct) },
                  { label: t('dashboard.chart.svc'), color: TIER_COLORS[item.id], value: String(item.services) },
                  { label: item.members.join(', ') || '—', color: TIER_COLORS[item.id], value: '' },
                ],
              })
            }
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x="70" y="66" textAnchor="middle" className="donut-center-value">
          {items.length}
        </text>
        <text x="70" y="82" textAnchor="middle" className="donut-center-label">
          {t('dashboard.chart.tiers')}
        </text>
      </svg>
      <ChartTip hover={hover} />
      <ul className="chart-legend">
        {items.map((item) => (
          <li key={item.id}>
            <span className="swatch" style={{ background: TIER_COLORS[item.id] }} />
            <div>
              <strong>{t(`dashboard.tier.${item.id}`)}</strong>
              <span>
                {item.services} {t('dashboard.chart.svc')} · {fmt(item.expectedMoves, 0)} moves ·{' '}
                {pct(item.sharePct)} · {item.members.join(', ') || '—'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VolumeCompareChart({ rows, colorMap, t }) {
  const max = Math.max(...rows.map((r) => Math.max(r.expectedMovesPeriod, r.proformaMovesPeriod)), 1);
  return (
    <div className="chart-compare" role="img" aria-label={t('dashboard.chart.volumeCompare')}>
      {rows.map((r) => {
        const color =
          colorMap.get(String(r.service).trim().toUpperCase()) || METRIC_COLORS.expected;
        return (
          <div key={r.service} className="chart-compare-row">
            <div className="chart-compare-label">
              <strong style={{ color }}>
                <i className="svc-dot" style={{ background: color }} />
                {r.service}
              </strong>
              <span>
                {pct(r.sharePct)} · Δ{' '}
                {(r.expectedMovesPeriod - r.proformaMovesPeriod) >= 0 ? '+' : ''}
                {fmt(r.expectedMovesPeriod - r.proformaMovesPeriod, 0)}
              </span>
            </div>
            <div className="chart-compare-bars">
              <div className="chart-compare-track">
                <div
                  className="chart-compare-fill proforma"
                  style={{ width: `${(r.proformaMovesPeriod / max) * 100}%` }}
                  title={`${t('dashboard.col.proforma')}: ${fmt(r.proformaMovesPeriod, 0)}`}
                />
              </div>
              <div className="chart-compare-track">
                <div
                  className="chart-compare-fill expected"
                  style={{
                    width: `${(r.expectedMovesPeriod / max) * 100}%`,
                    background: color,
                  }}
                  title={`${t('dashboard.col.expected')}: ${fmt(r.expectedMovesPeriod, 0)}`}
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="chart-compare-key">
        <span>
          <i className="key proforma" /> {t('dashboard.col.proforma')}
        </span>
        <span>
          <i className="key expected" /> {t('dashboard.col.expected')} ({t('dashboard.chart.svcColorNote')})
        </span>
      </div>
    </div>
  );
}

function OccupationChart({ rows, colorMap, t }) {
  const max = Math.max(...rows.map((r) => r.meterHoursPeriod || r.meterHours || 0), 1);
  return (
    <div className="chart-compare" role="img" aria-label={t('dashboard.chart.occupation')}>
      {rows.map((r) => {
        const mh = r.meterHoursPeriod ?? r.meterHours ?? 0;
        const color =
          colorMap.get(String(r.service).trim().toUpperCase()) || METRIC_COLORS.mh;
        return (
          <div key={r.service} className="chart-compare-row">
            <div className="chart-compare-label">
              <strong style={{ color }}>
                <i className="svc-dot" style={{ background: color }} />
                {r.service}
              </strong>
              <span>{fmt(mh, 0)} MH</span>
            </div>
            <div className="chart-compare-bars">
              <div className="chart-compare-track">
                <div
                  className="chart-compare-fill expected"
                  style={{ width: `${(mh / max) * 100}%`, background: color }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function MiniGantt({ blocks, quayLength, colorMap, t }) {
  const [hov, setHov] = useState(null);
  const [filter, setFilter] = useState('all');
  const totalH = 168;
  const w = 700;
  const padL = 48;
  const padR = 12;
  const innerW = w - padL - padR;
  const svgH = 340;
  const plotH = svgH - 20;
  const q = Math.max(1, quayLength || 600);

  // Only show week 0 blocks, normalize hours to 0-168 range for display
  const week0Blocks = useMemo(
    () => (blocks || []).filter((c) => (c.weekIndex ?? 0) === 0).map((c) => ({
      ...c,
      startHour: c.startHour % 168,
      endHour: Math.min(c.endHour % 168 === 0 && c.endHour > 0 ? 168 : c.endHour % 168, 168),
    })),
    [blocks]
  );

  const services = useMemo(
    () => [...new Set(week0Blocks.map((c) => String(c.service || '').toUpperCase()))].filter(Boolean),
    [week0Blocks]
  );
  const filtered =
    filter === 'all'
      ? week0Blocks
      : week0Blocks.filter((c) => String(c.service || '').toUpperCase() === filter);

  const overlaps = useMemo(() => {
    const regions = [];
    for (let i = 0; i < filtered.length; i++) {
      for (let j = i + 1; j < filtered.length; j++) {
        const a = filtered[i];
        const b = filtered[j];
        const startHour = Math.max(a.startHour, b.startHour);
        const endHour = Math.min(a.endHour, b.endHour);
        const fromMeter = Math.max(a.fromMeter, b.fromMeter);
        const toMeter = Math.min(a.toMeter, b.toMeter);
        if (startHour < endHour && fromMeter < toMeter) {
          regions.push({
            startHour,
            endHour,
            fromMeter,
            toMeter,
            key: `ov-${i}-${j}-${startHour}`,
          });
        }
      }
    }
    return regions;
  }, [filtered]);

  return (
    <div className="dash-gantt">
      <div className="dash-gantt-filters">
        <button
          type="button"
          className={`chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t('ops.layerAll')}
        </button>
        {services.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip ${filter === s ? 'active' : ''}`}
            style={
              filter === s
                ? { background: colorMap.get(s) || undefined, borderColor: colorMap.get(s) || undefined, color: '#fff' }
                : {}
            }
            onClick={() => setFilter((f) => (f === s ? 'all' : s))}
          >
            {s}
          </button>
        ))}
      </div>
      <div style={{ position: 'relative', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${w} ${svgH}`} style={{ width: '100%', minWidth: 400, display: 'block' }}>
          <defs>
            {filtered.map((c, i) => {
              const x1 = padL + (c.startHour / totalH) * innerW;
              const x2 = padL + (Math.min(c.endHour, totalH) / totalH) * innerW;
              const barW = Math.max(4, x2 - x1);
              const y1 = (c.fromMeter / q) * plotH;
              const y2 = (c.toMeter / q) * plotH;
              const barH = Math.max(6, y2 - y1);
              return (
                <clipPath id={`clip-mini-${i}`} key={i}>
                  <rect x={x1 + 1} y={y1 + 1} width={Math.max(0, barW - 4)} height={Math.max(0, barH - 2)} />
                </clipPath>
              );
            })}
          </defs>

          {DAY_ORDER.map((day, i) => {
            const x = padL + (i / 7) * innerW;
            const dayW = innerW / 7;
            return (
              <g key={day}>
                {i % 2 === 1 && <rect x={x} y={0} width={dayW} height={svgH - 16} fill="rgba(30,58,85,0.15)" />}
                <line x1={x} y1={0} x2={x} y2={svgH - 16} stroke="rgba(30,58,85,0.5)" strokeWidth="1" />
                <text x={x + dayW / 2} y={svgH - 4} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--muted)' }}>
                  {t(`days.${String(day || "").toLowerCase()}`)}
                </text>
              </g>
            );
          })}
          <line
            x1={padL + innerW}
            y1={0}
            x2={padL + innerW}
            y2={svgH - 16}
            stroke="rgba(30,58,85,0.5)"
            strokeWidth="1"
          />

          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const meter = Math.round(q * pct);
            const y = pct * plotH;
            return (
              <g key={pct}>
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  style={{ fontSize: 8, fill: 'var(--muted)', fontWeight: 500 }}
                >
                  {meter}m
                </text>
                <line x1={padL - 3} x2={padL} y1={y} y2={y} stroke="rgba(138,160,184,0.4)" strokeWidth="1" />
              </g>
            );
          })}

          {filtered.map((c, i) => {
            const x1 = padL + (c.startHour / totalH) * innerW;
            const x2 = padL + (Math.min(c.endHour, totalH) / totalH) * innerW;
            const barW = Math.max(4, x2 - x1);
            const y1 = (c.fromMeter / q) * plotH;
            const y2 = (c.toMeter / q) * plotH;
            const barH = Math.max(6, y2 - y1);
            const color = colorMap.get(String(c.service || '').trim().toUpperCase()) || '#0e7490';

            const vName = (c.vesselName || c.service || '').replace(/^MV\s+/i, '');
            const etbStr = t(`days.${String(c.etbDay || "").toLowerCase()}`) + ' ' + (c.etbTime || '');
            const etdStr = t(`days.${String(c.etdDay || "").toLowerCase()}`) + ' ' + (c.etdTime || '');

            const lineH = 10;
            const lines = [
              vName,
              `LOA: ${c.loa || 0}m`,
              `ETB: ${etbStr}`,
              `ETD: ${etdStr}`,
              `Vol: ${c.expectedVolume || c.volume || 0}`,
            ];
            const linesToDraw = lines.filter((_, idx) => idx * lineH + lineH <= barH);
            const totalTextH = linesToDraw.length * lineH;
            const startY = y1 + (barH - totalTextH) / 2 + lineH * 0.75;

            return (
              <g key={c.key || c.id || `${c.service}-${c.startHour}-${i}`}>
                <rect
                  x={x1}
                  y={y1}
                  width={barW}
                  height={barH}
                  rx="3"
                  fill={color}
                  opacity="0.85"
                  style={{ cursor: 'pointer' }}
                  onMouseMove={(e) =>
                    setHov({
                      x: e.clientX,
                      y: e.clientY,
                      title: vName,
                      rows: [
                        { label: t('capacity.th.service'), color, value: c.service },
                        { label: 'LOA', color: '#8aa0b8', value: `${c.loa || 0}m` },
                        { label: t('capacity.th.etb'), color, value: etbStr },
                        { label: 'ETD', color, value: etdStr },
                        { label: 'Meter', color: '#8aa0b8', value: `${Math.round(c.fromMeter)}–${Math.round(c.toMeter)}m` },
                      ],
                    })
                  }
                  onMouseLeave={() => setHov(null)}
                />
                {barW > 20 && linesToDraw.length > 0 && (
                  <text
                    x={x1 + 3}
                    y={startY}
                    clipPath={`url(#clip-mini-${i})`}
                    style={{ fontSize: 6.5, fill: '#fff', fontWeight: 600, pointerEvents: 'none' }}
                  >
                    {linesToDraw.map((line, idx) => (
                      <tspan key={idx} x={x1 + 3} dy={idx === 0 ? 0 : lineH}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
              </g>
            );
          })}

          {overlaps.map((ov) => {
            const x1 = padL + (ov.startHour / totalH) * innerW;
            const x2 = padL + (Math.min(ov.endHour, totalH) / totalH) * innerW;
            const barW = Math.max(2, x2 - x1);
            const y1 = (ov.fromMeter / q) * plotH;
            const y2 = (ov.toMeter / q) * plotH;
            const barH = Math.max(2, y2 - y1);
            return (
              <rect
                key={ov.key}
                x={x1}
                y={y1}
                width={barW}
                height={barH}
                rx="3"
                fill="rgba(239,68,68,0.22)"
                stroke="var(--danger)"
                strokeWidth="2"
                strokeDasharray="4 2"
                style={{ pointerEvents: 'none' }}
              />
            );
          })}
        </svg>
        <ChartTip hover={hov} />
      </div>
    </div>
  );
}

export default function Dashboard({ model }) {
  const { t } = useI18n();
  const { terminal, metrics, services, equipment, lockZones, cranes, externalBerths, ui } = model;
  const period = reportPeriodOf(ui?.horizon || ui?.timeScale || 'week');

  const colorMap = useMemo(() => buildServiceColorMap(services), [services]);

  const dash = useMemo(
    () =>
      buildDashboard({
        services,
        terminal,
        metrics,
        equipment,
        lockZones,
        cranes,
        period,
      }),
    [services, terminal, metrics, equipment, lockZones, cranes, period]
  );

  const ops = useMemo(
    () =>
      buildOperations({
        services,
        terminal,
        metrics,
        lockZones,
        berth: dash.berth,
        externalBerths,
        period,
        avgPmph: dash.kpis.avgPmph,
      }),
    [services, terminal, metrics, lockZones, externalBerths, period, dash]
  );

  const band = classifyBor(dash.kpis.bu, BOR_BANDS);
  const calls = useMemo(() => sortedCalls(services), [services]);
  const k = dash.kpis;
  const tiers = dash.customers;
  const ts = dash.timeSeries || [];

  const axisLabels = useMemo(() => {
    if (period === 'week') return ts.map((d) => t(`days.${String(d.key || "").toLowerCase()}`));
    if (period === 'month') {
      return ts.map((d, i) => {
        const [week, day] = String(d.key).split('-');
        if (!day || i % 7 !== 0) return '';
        return t('dashboard.weekShort', { n: week, day: t(`days.${String(day || "").toLowerCase()}`) });
      });
    }
    return ts.map((d, i) => (i % Math.max(1, Math.ceil(ts.length / 6)) === 0 ? d.key : ''));
  }, [ts, period, t]);

  const tipLabels = useMemo(() => {
    if (period === 'week') return ts.map((d) => t(`daysFull.${String(d.key || "").toLowerCase()}`));
    if (period === 'month') {
      return ts.map((d) => {
        const [week, day] = String(d.key).split('-');
        return t('dashboard.weekShort', { n: week, day: t(`daysFull.${String(day || "").toLowerCase()}`) });
      });
    }
    return ts.map((d) => d.key);
  }, [ts, period, t]);

  const areaVolume = useMemo(() => {
    const last = ts[ts.length - 1];
    return {
      labels: axisLabels,
      series: [
        {
          id: 'proforma',
          label: t('dashboard.col.proforma'),
          color: METRIC_COLORS.proforma,
          detail: last ? `${fmt(last.cumulativeProforma, 0)} moves` : undefined,
          values: ts.map((d) => d.cumulativeProforma),
        },
        {
          id: 'expected',
          label: t('dashboard.col.expected'),
          color: METRIC_COLORS.expected,
          detail: last ? `${fmt(last.cumulativeExpected, 0)} moves` : undefined,
          values: ts.map((d) => d.cumulativeExpected),
        },
      ],
    };
  }, [ts, axisLabels, t]);

  const areaMh = useMemo(() => {
    const peakMh = Math.max(...ts.map((d) => d.mhLoad), 0);
    const peakConcurrent = Math.max(...ts.map((d) => d.concurrentMeters), 0);
    return {
      labels: axisLabels,
      series: [
        {
          id: 'mh',
          label: t('dashboard.chart.mhLoad'),
          color: METRIC_COLORS.mh,
          detail: `${t('dashboard.chart.peak')}: ${fmt(peakMh, 0)} MH`,
          values: ts.map((d) => d.mhLoad),
        },
        {
          id: 'concurrent',
          label: t('dashboard.chart.concurrentMeters'),
          color: METRIC_COLORS.concurrent,
          detail: `${t('dashboard.chart.peak')}: ${fmt(peakConcurrent, 0)} m`,
          values: ts.map((d) => d.concurrentMeters),
        },
      ],
    };
  }, [ts, axisLabels, t]);

  const areaTier = useMemo(() => {
    const last = ts[ts.length - 1]?.cumulativeTier || {};
    return {
      labels: axisLabels,
      series: [
        {
          id: 'large',
          label: t('dashboard.tier.large'),
          color: TIER_COLORS.large,
          detail: last.large != null ? `${fmt(last.large, 0)} moves` : undefined,
          values: ts.map((d) => d.cumulativeTier.large),
        },
        {
          id: 'medium',
          label: t('dashboard.tier.medium'),
          color: TIER_COLORS.medium,
          detail: last.medium != null ? `${fmt(last.medium, 0)} moves` : undefined,
          values: ts.map((d) => d.cumulativeTier.medium),
        },
        {
          id: 'small',
          label: t('dashboard.tier.small'),
          color: TIER_COLORS.small,
          detail: last.small != null ? `${fmt(last.small, 0)} moves` : undefined,
          values: ts.map((d) => d.cumulativeTier.small),
        },
      ],
    };
  }, [ts, axisLabels, t]);

  const areaByService = useMemo(() => {
    const codes = dash.byService.map((r) => String(r.service).trim().toUpperCase());
    const last = ts[ts.length - 1]?.cumulativeByService || {};
    return {
      labels: axisLabels,
      series: codes.map((code) => {
        const row = dash.byService.find(
          (r) => String(r.service).trim().toUpperCase() === code
        );
        return {
          id: code,
          label: row?.service || code,
          color: colorMap.get(code) || METRIC_COLORS.expected,
          detail: `${fmt(last[code] || row?.expectedMovesPeriod || 0, 0)} moves · ${pct(row?.sharePct || 0)}`,
          values: ts.map((d) => (d.cumulativeByService && d.cumulativeByService[code]) || 0),
        };
      }),
    };
  }, [ts, axisLabels, dash.byService, colorMap]);

  return (
    <div className="page-grid dashboard-page">

      {/* ── Tiêu đề ── */}
      <section className="panel span-12 dashboard-hero">
        <div className="dashboard-hero-main">
          <h2>{t('dashboard.title')}</h2>
          <p className="hint">{t('dashboard.subtitle')}</p>
        </div>
      </section>

      {/* ── 4 KPI tổng quan ── */}
      <section className="panel span-3 kpi-card">
        <span className="kpi-label">Tỷ lệ chiếm dụng cầu bến (BOR)</span>
        <strong className={`kpi-value ${k.bu >= 0.7 ? 'danger' : k.bu >= 0.55 ? 'warn' : 'ok'}`}>
          {pct(k.bu)}
        </strong>
        <span className="kpi-sub">{band ? t(`bor.${band.id}.label`) : '—'}</span>
      </section>
      <section className="panel span-3 kpi-card">
        <span className="kpi-label">Sản lượng dự kiến (Moves)</span>
        <strong className="kpi-value">{fmt(k.expectedMoves, 0)}</strong>
        <span className="kpi-sub">Proforma: {fmt(k.proformaMoves, 0)}</span>
      </section>
      <section className="panel span-3 kpi-card">
        <span className="kpi-label">Lượt tàu cập bến</span>
        <strong className="kpi-value">{fmt(k.calls, 0)}</strong>
        <span className="kpi-sub">Tuyến dịch vụ: {k.serviceLines}</span>
      </section>
      <section className="panel span-3 kpi-card">
        <span className="kpi-label">Năng suất bốc dỡ PMPH</span>
        <strong className="kpi-value">{fmt(k.avgPmph, 1)}</strong>
        <span className="kpi-sub">Mật độ cẩu TB: {fmt(k.avgCraneDensity, 2)}</span>
      </section>

      {/* ── Lịch tàu cập bến (ưu tiên cao nhất – gần đầu trang) ── */}
      <section className="panel span-12">
        <h3>Lịch tàu cập bến theo cầu (Berth Schedule)</h3>
        <p className="hint">
          Trục ngang = thời gian trong tuần (T2→CN) · Trục dọc = vị trí cầu bến (m từ thượng lưu)
          · Chiều cao ô = LOA tàu · Màu đỏ đứt = vùng chồng đề
        </p>
        <MiniGantt blocks={ops.motherBlocks} quayLength={terminal.quayLength} colorMap={colorMap} t={t} />
      </section>

      {/* ── Chỉ số khai thác cầu bến + thiết bị + sản lượng ── */}
      <section className="panel span-4">
        <h3>Thông số cầu bến</h3>
        <div className="dash-metric-list">
          <div>
            <span>Giờ-mét khả dụng</span>
            <strong>{fmt(k.availableMh, 0)}</strong>
          </div>
          <div>
            <span>Giờ-mét proforma</span>
            <strong>{fmt(k.proformaMh, 0)}</strong>
          </div>
          <div>
            <span>Giờ-mét mất do bảo trì/khóa</span>
            <strong>{fmt(k.lockLostMh, 0)}</strong>
          </div>
          <div>
            <span>Chiếm dụng cầu TB</span>
            <strong>{fmt(k.avgOccupation, 0)} m</strong>
          </div>
        </div>
      </section>

      <section className="panel span-4">
        <h3>Thông số thiết bị</h3>
        <div className="dash-metric-list">
          <div>
            <span>Hệ số sử dụng cẩu STS</span>
            <strong className={k.stsUtilization > 1 ? 'danger' : ''}>{pct(k.stsUtilization)}</strong>
          </div>
          <div>
            <span>Hệ số sử dụng bãi CY</span>
            <strong className={k.cyUtilization > 1 ? 'danger' : ''}>{pct(k.cyUtilization)}</strong>
          </div>
          <div>
            <span>Số cẩu STS hiệu dụng</span>
            <strong>{fmt(k.craneCount, 0)}</strong>
          </div>
          <div>
            <span>Năng lực cẩu STS/năm</span>
            <strong>{fmt(k.stsCapacityYear, 0)}</strong>
          </div>
        </div>
      </section>

      <section className="panel span-4">
        <h3>Sản lượng kỳ</h3>
        <div className="dash-metric-list">
          <div>
            <span>Tổng sản lượng thực tế</span>
            <strong>{fmt(k.totalMoves, 0)}</strong>
          </div>
          <div>
            <span>Chênh lệch Thực/Proforma</span>
            <strong className={k.varianceMoves >= 0 ? 'ok' : 'danger'}>
              {k.varianceMoves >= 0 ? '+' : ''}{fmt(k.varianceMoves, 0)}
            </strong>
          </div>
          <div>
            <span>Hệ số kỳ phân tích</span>
            <strong>×{fmt(dash.weeksInPeriod, 2)}</strong>
          </div>
        </div>
      </section>

      {/* ── Đồ thị xu thế: Sản lượng + Giờ-mét (2 cột) ── */}
      <section className="panel span-6">
        <AreaChart
          title="Xu thế sản lượng tích lũy"
          hint="Sản lượng moves tích lũy theo ngày/tuần trong kỳ phân tích"
          labels={areaVolume.labels}
          tipLabels={tipLabels}
          series={areaVolume.series}
        />
      </section>
      <section className="panel span-6">
        <AreaChart
          title="Xu thế giờ-mét chiếm dụng (MH)"
          hint="Tổng giờ-mét chiếm dụng cầu bến và tải trọng vận hành theo thời gian"
          labels={areaMh.labels}
          tipLabels={tipLabels}
          series={areaMh.series}
        />
      </section>

      {/* ── Đồ thị xu thế: Theo nhóm KH + Theo tuyến dịch vụ (2 cột) ── */}
      <section className="panel span-6">
        <AreaChart
          title="Sản lượng theo nhóm khách hàng"
          hint="Phân bổ sản lượng tích lũy theo nhóm: Lớn / Vừa / Nhỏ"
          labels={areaTier.labels}
          tipLabels={tipLabels}
          series={areaTier.series}
          stacked
          height={220}
        />
      </section>
      <section className="panel span-6">
        <AreaChart
          title="Sản lượng theo tuyến dịch vụ"
          hint="Phân bổ sản lượng tích lũy theo từng tuyến/service"
          labels={areaByService.labels}
          tipLabels={tipLabels}
          series={areaByService.series}
          stacked
          height={220}
        />
      </section>

      {/* ── Cơ cấu khách hàng + So sánh sản lượng (2 cột) ── */}
      <section className="panel span-6">
        <h3>Cơ cấu khách hàng theo nhóm</h3>
        <p className="hint">Phân loại dịch vụ theo thị phần sản lượng</p>
        <TierDonut tiers={tiers} t={t} />
        <div className="tier-cards">
          {['large', 'medium', 'small'].map((id) => {
            const tier = tiers[id];
            return (
              <div key={id} className={`tier-card tier-${id}`}>
                <strong>{t(`dashboard.tier.${id}`)}</strong>
                <span>{tier.services} tuyến</span>
                <em>{fmt(tier.expectedMoves, 0)} moves</em>
                <small>{tier.members.join(', ') || '—'}</small>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel span-6">
        <h3>So sánh sản lượng theo tuyến</h3>
        <p className="hint">Thực tế vs Proforma và mức chiếm dụng giờ-mét theo tuyến dịch vụ</p>
        <VolumeCompareChart rows={dash.byService} colorMap={colorMap} t={t} />
        <div style={{ marginTop: '1rem' }}>
          <OccupationChart rows={dash.byService} colorMap={colorMap} t={t} />
        </div>
      </section>

      {/* ── Strategy Panels (BOR analysis, heatmap…) ── */}
      <StrategyPanels berth={dash.berth} ops={ops} />

      {/* ── Bảng chi tiết dịch vụ ── */}
      <section className="panel span-12">
        <h3>Chi tiết theo tuyến dịch vụ</h3>
        <div className="table-wrap touch-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Màu</th>
                <th>Tuyến dịch vụ</th>
                <th>Nhóm KH</th>
                <th>Proforma (Moves)</th>
                <th>Thực tế (Moves)</th>
                <th>Thị phần</th>
              </tr>
            </thead>
            <tbody>
              {dash.byService.map((r) => {
                const tierId =
                  r.sharePct >= 0.15 || r.expectedMovesPeriod >= 2000 * dash.weeksInPeriod
                    ? 'large'
                    : r.sharePct >= 0.05 || r.expectedMovesPeriod >= 800 * dash.weeksInPeriod
                      ? 'medium'
                      : 'small';
                const color =
                  colorMap.get(String(r.service).trim().toUpperCase()) || METRIC_COLORS.expected;
                return (
                  <tr key={r.service}>
                    <td>
                      <span className="svc-swatch" style={{ background: color }} title={color} />
                    </td>
                    <td>
                      <strong style={{ color }}>{r.service}</strong>
                    </td>
                    <td>
                      <span className={`tier-pill tier-${tierId}`}>{t(`dashboard.tier.${tierId}`)}</span>
                    </td>
                    <td>{fmt(r.proformaMovesPeriod, 0)}</td>
                    <td>{fmt(r.expectedMovesPeriod, 0)}</td>
                    <td>{pct(r.sharePct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
