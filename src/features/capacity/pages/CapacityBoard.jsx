import React, { useMemo } from 'react';
import { calcBerthCapacity, calcEquipmentCapacity, classifyBor } from '../utils/index';
import { BOR_BANDS } from '../../../shared/utils/seed';
import { useI18n } from '../../../shared/i18n/I18nContext';
import { DAY_KEYS, shiftsOf } from '../../../shared/utils/uiSettings';
import {
  bargeCapacityFromWindows,
  bargeCapacityHorizon,
  layoutMotherVessels,
  planBargeWindows,
} from '../../berth-plan/utils/operations';
import { layoutLockZones } from '../../../shared/utils/lockZone';
import { defaultColorForService, resolveServiceColor } from '../../berth-plan/utils/serviceColor';
import PageToolbar from '../../../shared/components/PageToolbar';
import { EQUIPMENT_COLORS, EQUIPMENT_ICONS, IconBarge, IconTruck } from '../../../shared/components/icons/PortIcons';

function fmt(n, d = 0) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
}

function pct(n) {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function uid() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export default function CapacityBoard({ model }) {
  const { t } = useI18n();
  const {
    terminal,
    metrics,
    services,
    equipment,
    setMetrics,
    setServices,
    setServiceLineColor,
    setEquipment,
    lockZones,
    ui,
  } = model;

  const berth = useMemo(
    () => calcBerthCapacity({ services, terminal, metrics, lockZones }),
    [services, terminal, metrics, lockZones]
  );
  const equip = useMemo(() => calcEquipmentCapacity(equipment), [equipment]);
  const band = classifyBor(berth.berthUtilization, BOR_BANDS);
  const bargeCap = useMemo(() => {
    const quay = Math.max(50, Number(terminal.quayLength) || 600);
    const locks = layoutLockZones(lockZones || [], quay, 1);
    const obstacles = locks
      .filter((z) => (Number(z.capacityPct) ?? 0) <= 0)
      .map((z) => ({
        startHour: z.startHour,
        endHour: z.endHour,
        fromMeter: z.fromMeter,
        toMeter: z.toMeter,
      }));
    const shifts = shiftsOf(ui);
    const liveBlocks = layoutMotherVessels(berth.services, quay, 1, obstacles);
    const repeatBlocks = layoutMotherVessels(
      berth.services.filter((row) => row.lineKind !== 'adhoc'),
      quay,
      1,
      obstacles
    );
    const args = {
      lockBlocks: locks,
      quayLength: quay,
    };
    const hours = berth.barge?.berthHours;
    const occupation = berth.barge?.occupation || 73;
    const live = bargeCapacityFromWindows(planBargeWindows({ ...args, blocks: liveBlocks }), hours, occupation, shifts);
    const repeat = bargeCapacityFromWindows(
      planBargeWindows({ ...args, blocks: repeatBlocks }),
      hours,
      occupation,
      shifts
    );
    const yearWeeks = Number(terminal.workingWeeksPerYear) || 52;
    return {
      shifts,
      live,
      week: bargeCapacityHorizon(live, repeat, 1),
      month: bargeCapacityHorizon(live, repeat, yearWeeks / 12),
      quarter: bargeCapacityHorizon(live, repeat, yearWeeks / 4),
      year: bargeCapacityHorizon(live, repeat, yearWeeks),
    };
  }, [berth.services, berth.barge, lockZones, terminal, ui]);

  const updateService = (id, patch) => {
    setServices((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.service != null) {
          const key = String(patch.service).trim().toUpperCase();
          const existing = rows.find(
            (s) =>
              s.id !== id &&
              String(s.service || '')
                .trim()
                .toUpperCase() === key
          );
          if (existing?.color) next.color = existing.color;
          else if (!next.color) next.color = defaultColorForService(patch.service, rows);
        }
        return next;
      })
    );
  };

  const addService = () => {
    setServices((rows) => {
      const name = `SVC${rows.length + 1}`;
      return [
        ...rows,
        {
          id: uid(),
          service: name,
          color: defaultColorForService(name, rows),
          vesselName: '',
          loa: 200,
          volume: 800,
          expectedVolume: 800,
          lineKind: 'fixed',
          volumeChangePct: 5,
          timeChangePct: 5,
          berthSide: 'downstream',
          etbDay: 'Mon',
          etbTime: '08:00',
          etdDay: 'Mon',
          etdTime: '20:00',
          cmph: metrics.vesselCmph,
        },
      ];
    });
  };

  const removeService = (id) => setServices((rows) => rows.filter((r) => r.id !== id));

  const metricKeys = [
    ['bargeVesselVolumeRatio', 0.01],
    ['vesselArrivalHrs', 0.1],
    ['vesselDepartureHrs', 0.1],
    ['bargeArrivalHrs', 0.1],
    ['bargeDepartureHrs', 0.1],
    ['bargeCallsPerWeek', 1],
    ['bargeLoa', 1],
    ['bargeCmph', 1],
    ['vesselCmph', 1],
    ['mooringCap', 1],
    ['targetBorPct', 1],
  ];

  return (
    <div className="page-grid">
      <PageToolbar>
        <button type="button" className="btn" data-tip={t('tip.addService')} onClick={addService}>
          {t('capacity.addService')}
        </button>
        {[
          ['cap-metrics', 'capacity.metrics'],
          ['cap-result', 'capacity.result'],
          ['cap-services', 'capacity.services'],
          ['cap-equip', 'capacity.equip'],
        ].map(([id, key]) => (
          <button
            key={id}
            type="button"
            className="chip"
            data-tip={t('tip.jump')}
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {t(key)}
          </button>
        ))}
      </PageToolbar>

      <section id="cap-metrics" className="panel span-7">
        <h2>{t('capacity.metrics')}</h2>
        <p className="hint">{t('capacity.metricsHint')}</p>
        <div className="aligned-fields">
          {metricKeys.map(([key, step]) => (
            <label key={key} className="aligned-row">
              <span>{t(`capacity.metric.${key}`)}</span>
              <input
                type="number"
                step={step}
                value={metrics[key]}
                onChange={(e) => setMetrics({ ...metrics, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      </section>

      <section id="cap-result" className="panel span-5 kpi-stack">
        <h2>{t('capacity.result')}</h2>
        <div className="kpi-hero">
          <div className="kpi-label">{t('capacity.bu')}</div>
          <div className={`kpi-value ${band?.id || ''}`}>{pct(berth.berthUtilization)}</div>
          <div className="kpi-band">{band ? t(`bor.${band.id}.label`) : '—'}</div>
        </div>
        <div className="aligned-fields result-lines">
          {[
            [t('capacity.kpi.availableMhYear'), fmt(berth.availableMeterHoursYear)],
            [t('capacity.kpi.proformaMhWeek'), fmt(berth.proformaMeterHoursWeek, 0)],
            [t('capacity.kpi.mainlineMhWeek'), fmt(berth.mainlineMeterHours, 0)],
            [t('capacity.kpi.bargeMhWeek'), fmt(berth.bargeMeterHours, 0)],
            [t('capacity.kpi.proformaVolWeek'), fmt(berth.totalVolumeWeek)],
            [t('capacity.kpi.annualMoves'), fmt(berth.annualVolumeAtProforma)],
            [t('capacity.kpi.stsCapacity'), fmt(equip.quayMoves)],
            [t('capacity.kpi.cyCapacity'), fmt(equip.cyEqCapacity)],
          ].map(([label, value]) => (
            <div key={label} className="aligned-row">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <h3 className="barge-cap-title">{t('capacity.bargeCapTitle')}</h3>
        <p className="hint">{t('capacity.bargeCapHint')}</p>
        <div className="barge-cap-shifts">
          {bargeCap.live.byShift.map((row) => (
            <div key={row.id} className="aligned-row">
              <span>
                {row.name}{' '}
                <em>
                  {row.start}–{row.end}
                </em>
              </span>
              <strong>{fmt(row.calls, 0)}</strong>
            </div>
          ))}
        </div>
        <div className="barge-cap-days">
          {bargeCap.live.byDay.map((row) => (
            <span key={row.key}>
              {t(`days.${row.key}`)} {fmt(row.calls, 0)}
            </span>
          ))}
        </div>
        <div className="aligned-fields result-lines">
          {[
            [t('horizon.week'), bargeCap.week.calls],
            [t('horizon.month'), bargeCap.month.calls],
            [t('horizon.quarter'), bargeCap.quarter.calls],
            [t('horizon.year'), bargeCap.year.calls],
          ].map(([label, value]) => (
            <div key={label} className="aligned-row">
              <span>{label}</span>
              <strong>{fmt(value, 0)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section id="cap-services" className="panel span-12">
        <div className="panel-head">
          <div>
            <h2>{t('capacity.services')}</h2>
            <p className="hint">
              {t('capacity.servicesHint', { cap: metrics.mooringCap, quay: terminal.quayLength })}
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table svc-table">
            <colgroup>
              <col className="c-svc" />
              <col className="c-color" />
              <col className="c-vessel" />
              <col className="c-kind" />
              <col className="c-pct" />
              <col className="c-pct" />
              <col className="c-kind" />
              <col className="c-num" />
              <col className="c-num" />
              <col className="c-time" />
              <col className="c-time" />
              <col className="c-num" />
              <col className="c-num" />
              <col className="c-num" />
              <col className="c-num" />
              <col className="c-num" />
              <col className="c-num" />
              <col className="c-num" />
              <col className="c-act" />
            </colgroup>
            <thead>
              <tr>
                <th>{t('capacity.th.service')}</th>
                <th>{t('capacity.th.color')}</th>
                <th>{t('window.vesselName')}</th>
                <th>{t('capacity.th.lineKind')}</th>
                <th className="num">{t('capacity.th.volumeChange')}</th>
                <th className="num">{t('capacity.th.timeChange')}</th>
                <th>{t('capacity.th.berthSide')}</th>
                <th className="num">{t('capacity.th.loa')}</th>
                <th className="num">{t('capacity.th.occ')}</th>
                <th>{t('capacity.th.etb')}</th>
                <th>{t('capacity.th.etd')}</th>
                <th className="num">{t('capacity.th.netStay')}</th>
                <th className="num">{t('capacity.th.berthH')}</th>
                <th className="num">{t('capacity.th.meterH')}</th>
                <th className="num">'PROFORMA'</th>
                <th className="num">'D? KI?N'</th>
                <th className="num">{t('capacity.th.pmph')}</th>
                <th className="num">{t('capacity.th.crane')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {berth.services.map((row) => {
                const raw = services.find((s) => s.id === row.id) || row;
                const color = resolveServiceColor(raw, services);
                return (
                  <tr key={row.id}>
                    <td>
                      <input
                        className="cell"
                        value={raw.service}
                        onChange={(e) => updateService(row.id, { service: e.target.value })}
                      />
                    </td>
                    <td className="color-cell">
                      <input
                        type="color"
                        className="color-input"
                        value={color}
                        title={t('window.serviceColorHint')}
                        onChange={(e) => setServiceLineColor?.(raw.service, e.target.value)}
                      />
                    </td>
                    <td>
                      <textarea className="cell" rows={2} style={{ resize: "none", overflow: "hidden", minHeight: "2.4rem", background: "transparent", border: "none", color: "inherit", outline: "none", textAlign: "center" }} value={raw.vesselName || ""} placeholder={t("window.vesselPlaceholder")} onChange={(e) => updateService(row.id, { vesselName: e.target.value })} />
                    </td>
                    <td>
                      <select
                        className="cell"
                        value={raw.lineKind === 'adhoc' ? 'adhoc' : 'fixed'}
                        title={t('capacity.th.lineKind')}
                        onChange={(e) => updateService(row.id, { lineKind: e.target.value })}
                      >
                        <option value="fixed">{t('capacity.lineFixed')}</option>
                        <option value="adhoc">{t('capacity.lineAdhoc')}</option>
                      </select>
                    </td>
                    <td className="num">
                      <input
                        className="cell num"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        disabled={raw.lineKind === 'adhoc'}
                        value={raw.lineKind === 'adhoc' ? 0 : raw.volumeChangePct ?? 0}
                        title={t('capacity.th.volumeChange')}
                        onChange={(e) =>
                          updateService(row.id, {
                            volumeChangePct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          })
                        }
                      />
                    </td>
                    <td className="num">
                      <input
                        className="cell num"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        disabled={raw.lineKind === 'adhoc'}
                        value={raw.lineKind === 'adhoc' ? 0 : raw.timeChangePct ?? 0}
                        title={t('capacity.th.timeChange')}
                        onChange={(e) =>
                          updateService(row.id, {
                            timeChangePct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="cell"
                        value={raw.berthManual ? 'manual' : raw.berthSide || 'downstream'}
                        title={t('capacity.sideDownstream', { quay: terminal.quayLength })}
                        onChange={(e) => {
                          const berthSide = e.target.value;
                          if (berthSide === 'manual') return;
                          updateService(row.id, { berthSide, berthManual: false, berthStart: null });
                        }}
                      >
                        <option value="upstream">{t('capacity.sideUpstream')}</option>
                        <option value="downstream">
                          {t('capacity.sideDownstream', { quay: terminal.quayLength })}
                        </option>
                        {raw.berthManual ? (
                          <option value="manual">{t('capacity.sideManual')}</option>
                        ) : null}
                      </select>
                    </td>
                    <td className="num">
                      <input
                        className="cell num"
                        type="number"
                        value={raw.loa}
                        onChange={(e) => updateService(row.id, { loa: Number(e.target.value) })}
                      />
                    </td>
                    <td className="num">{fmt(row.occupation, 1)}</td>
                    <td>
                      <div className="datetime">
                        <select
                          value={raw.etbDay}
                          onChange={(e) => updateService(row.id, { etbDay: e.target.value })}
                        >
                          {DAY_KEYS.map((d) => (
                            <option key={d} value={d}>
                              {t(`days.${d}`)}
                            </option>
                          ))}
                        </select>
                        <input
                          className="cell time"
                          value={raw.etbTime}
                          onChange={(e) => updateService(row.id, { etbTime: e.target.value })}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="datetime">
                        <select
                          value={raw.etdDay}
                          onChange={(e) => updateService(row.id, { etdDay: e.target.value })}
                        >
                          {DAY_KEYS.map((d) => (
                            <option key={d} value={d}>
                              {t(`days.${d}`)}
                            </option>
                          ))}
                        </select>
                        <input
                          className="cell time"
                          value={raw.etdTime}
                          onChange={(e) => updateService(row.id, { etdTime: e.target.value })}
                        />
                      </div>
                    </td>
                    <td className="num">{fmt(row.netPortstay, 1)}</td>
                    <td className="num">{fmt(row.berthHours, 1)}</td>
                    <td className="num emph">{fmt(row.meterHours, 0)}</td>
                    <td className="num">
                      <input
                        className="cell num"
                        type="number"
                        value={raw.volume}
                        onChange={(e) => updateService(row.id, { volume: Number(e.target.value) })}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="cell num"
                        type="number"
                        value={raw.expectedVolume ?? raw.volume}
                        onChange={(e) =>
                          updateService(row.id, { expectedVolume: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="num">{fmt(row.pmph, 1)}</td>
                    <td className="num">{fmt(row.craneDensity, 1)}</td>
                    <td>
                      <button type="button" className="btn-ghost" onClick={() => removeService(row.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="barge-row">
                <td>
                  <span className="icon-label">
                    <IconBarge size={16} />
                    {t('capacity.bargeDerived')}
                  </span>
                </td>
                <td className="muted">—</td>
                <td>{t('capacity.callsWeek', { n: fmt(berth.barge.callsPerWeek) })}</td>
                <td />
                <td />
                <td />
                <td />
                <td className="num">{fmt(berth.barge.loa)}</td>
                <td className="num">{fmt(berth.barge.occupation, 1)}</td>
                <td />
                <td />
                <td className="num">{fmt(berth.barge.netPortstay, 2)}</td>
                <td className="num">{fmt(berth.barge.berthHours, 2)}</td>
                <td className="num emph">{fmt(berth.barge.meterHours, 0)}</td>
                <td className="num">{fmt(berth.barge.volume)}</td>
                <td />
                <td />
                <td className="num">{fmt(berth.barge.cmph, 0)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="cap-equip" className="panel span-12">
        <div className="panel-head">
          <div>
            <h2>{t('capacity.equip')}</h2>
            <p className="hint">{t('capacity.equipHint')}</p>
          </div>
        </div>
        <div className="equip-grid">
          {equipment.fleet.map((eq, i) => (
            <div key={eq.type} className="equip-card">
              <div className="equip-type" style={{ color: EQUIPMENT_COLORS[eq.type] || undefined }}>
                {EQUIPMENT_ICONS[eq.type]
                  ? React.createElement(EQUIPMENT_ICONS[eq.type], { size: 36 })
                  : null}
                {eq.type}
              </div>
              <label>
                CMPH
                <input
                  type="number"
                  value={eq.cmph}
                  onChange={(e) => {
                    const fleet = [...equipment.fleet];
                    fleet[i] = { ...eq, cmph: Number(e.target.value) };
                    setEquipment({ ...equipment, fleet });
                  }}
                />
              </label>
              <label>
                {t('capacity.count')}
                <input
                  type="number"
                  value={eq.count}
                  onChange={(e) => {
                    const fleet = [...equipment.fleet];
                    fleet[i] = { ...eq, count: Number(e.target.value) };
                    setEquipment({ ...equipment, fleet });
                  }}
                />
              </label>
              <label>
                {t('capacity.availability')}
                <input
                  type="number"
                  step={0.01}
                  value={eq.availability}
                  onChange={(e) => {
                    const fleet = [...equipment.fleet];
                    fleet[i] = { ...eq, availability: Number(e.target.value) };
                    setEquipment({ ...equipment, fleet });
                  }}
                />
              </label>
              <label>
                {t('capacity.utilization')}
                <input
                  type="number"
                  step={0.01}
                  value={eq.utilization}
                  onChange={(e) => {
                    const fleet = [...equipment.fleet];
                    fleet[i] = { ...eq, utilization: Number(e.target.value) };
                    setEquipment({ ...equipment, fleet });
                  }}
                />
              </label>
              <div className="equip-cap">
                {t('capacity.movesYear', { n: fmt(equip.fleet[i]?.capacity) })}
              </div>
            </div>
          ))}
          <div className="equip-card summary">
            <div className="equip-type">{t('capacity.yardRollup')}</div>
            <label>
              <span className="icon-label">
                <IconTruck size={16} />
                {t('capacity.gateMoves')}
              </span>
              <input
                type="number"
                value={equipment.gateMovesDesigned}
                onChange={(e) =>
                  setEquipment({ ...equipment, gateMovesDesigned: Number(e.target.value) })
                }
              />
            </label>
            <label>
              {t('capacity.rehandleRatio')}
              <input
                type="number"
                step={0.01}
                value={equipment.rehandleRatio}
                onChange={(e) =>
                  setEquipment({ ...equipment, rehandleRatio: Number(e.target.value) })
                }
              />
            </label>
            <div className="equip-cap">{t('capacity.quayMoves', { n: fmt(equip.quayMoves) })}</div>
            <div className="equip-cap">
              {t('capacity.yardDemand', { n: fmt(equip.totalYardMoves) })}
            </div>
            <div className="equip-cap">{t('capacity.cyCap', { n: fmt(equip.cyEqCapacity) })}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
