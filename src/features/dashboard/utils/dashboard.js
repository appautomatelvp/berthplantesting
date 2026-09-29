import {
  dayIndex,
  toDayFraction,
  calcBerthCapacity,
  calcEquipmentCapacity,
  lockZonesLostMeterHoursWeek,
} from '../../capacity/utils/index.js';

/** Short-term expected moves; falls back to proforma window volume. */
export function effectiveVolume(row) {
  if (row == null) return 0;
  if (row.expectedVolume != null && row.expectedVolume !== '' && Number.isFinite(Number(row.expectedVolume))) {
    return Math.max(0, Number(row.expectedVolume));
  }
  return Math.max(0, Number(row.volume) || 0);
}

export function proformaVolume(row) {
  return Math.max(0, Number(row?.volume) || 0);
}

/** Period multipliers from a single weekly berth-window plan. */
export const PERIODS = ['week', 'month', 'quarter', 'year'];

export function periodWeeks(period, terminal = {}) {
  const weeksYear = Number(terminal.workingWeeksPerYear) || 52;
  switch (period) {
    case 'week':
      return 1;
    case 'month':
      return weeksYear / 12;
    case 'quarter':
      return weeksYear / 4;
    case 'year':
      return weeksYear;
    default:
      return 1;
  }
}

/**
 * Aggregate calls by service line code.
 * Same service (different vessel names) rolls into one bucket.
 */
export function aggregateByService(services = [], enriched = []) {
  const mhById = new Map((enriched || []).map((r) => [r.id, Number(r.meterHours) || 0]));
  const occById = new Map((enriched || []).map((r) => [r.id, Number(r.occupation) || 0]));
  const map = new Map();
  for (const row of services) {
    if (!row?.service) continue;
    const key = String(row.service).trim().toUpperCase();
    const cur = map.get(key) || {
      service: row.service,
      calls: 0,
      vessels: [],
      proformaMoves: 0,
      expectedMoves: 0,
      loaSum: 0,
      meterHours: 0,
      occupationSum: 0,
    };
    cur.calls += 1;
    cur.proformaMoves += proformaVolume(row);
    cur.expectedMoves += effectiveVolume(row);
    cur.loaSum += Number(row.loa) || 0;
    cur.meterHours += mhById.get(row.id) || 0;
    cur.occupationSum += occById.get(row.id) || Number(row.loa) || 0;
    if (row.vesselName) cur.vessels.push(row.vesselName);
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      avgLoa: r.calls ? r.loaSum / r.calls : 0,
      avgOccupation: r.calls ? r.occupationSum / r.calls : 0,
      varianceMoves: r.expectedMoves - r.proformaMoves,
      variancePct: r.proformaMoves > 0 ? (r.expectedMoves - r.proformaMoves) / r.proformaMoves : 0,
    }))
    .sort((a, b) => b.expectedMoves - a.expectedMoves);
}

/** Segment customers: large / medium / small by volume share of the plan. */
export function classifyCustomerTiers(byService = []) {
  const total = byService.reduce((s, r) => s + (r.expectedMoves || 0), 0) || 1;
  const tiers = { large: [], medium: [], small: [] };
  for (const r of byService) {
    const share = (r.expectedMoves || 0) / total;
    const row = { ...r, sharePct: share };
    if (share >= 0.15 || r.expectedMoves >= 2000) tiers.large.push(row);
    else if (share >= 0.05 || r.expectedMoves >= 800) tiers.medium.push(row);
    else tiers.small.push(row);
  }
  const summarize = (list, id) => ({
    id,
    services: list.length,
    calls: list.reduce((s, r) => s + r.calls, 0),
    expectedMoves: list.reduce((s, r) => s + r.expectedMoves, 0),
    proformaMoves: list.reduce((s, r) => s + r.proformaMoves, 0),
    meterHours: list.reduce((s, r) => s + r.meterHours, 0),
    sharePct: list.reduce((s, r) => s + r.sharePct, 0),
    members: list.map((r) => r.service),
  });
  return {
    large: summarize(tiers.large, 'large'),
    medium: summarize(tiers.medium, 'medium'),
    small: summarize(tiers.small, 'small'),
    rows: [...tiers.large, ...tiers.medium, ...tiers.small],
  };
}

export function scaleByPeriod(weekValue, period, terminal) {
  return weekValue * periodWeeks(period, terminal);
}

function serviceTierMap(byService) {
  const tiers = classifyCustomerTiers(byService);
  const map = new Map();
  for (const id of ['large', 'medium', 'small']) {
    for (const name of tiers[id].members || []) {
      map.set(String(name).toUpperCase(), id);
    }
  }
  return map;
}

/**
 * Daily time-series from the weekly berth plan (scientific base for area charts).
 * X = Monâ€¦Sun; Y = arrivals, concurrent quay meters, MH load, tier mix, cumulatives.
 */
export function buildWeeklyTimeSeries(services = [], enriched = [], byService = []) {
  const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const enrichMap = new Map((enriched || []).map((r) => [r.id, r]));
  const tierOf = serviceTierMap(byService);

  const days = DAY_KEYS.map((key, i) => ({
    key,
    index: i,
    arrivalsProforma: 0,
    arrivalsExpected: 0,
    concurrentMeters: 0,
    mhLoad: 0,
    callsPresent: 0,
    tierExpected: { large: 0, medium: 0, small: 0 },
    byServiceExpected: {},
  }));

  for (const row of services || []) {
    if (!row?.service) continue;
    const en = enrichMap.get(row.id) || row;
    let startH = (dayIndex(row.etbDay) + toDayFraction(row.etbTime)) * 24;
    let endH = (dayIndex(row.etdDay) + toDayFraction(row.etdTime)) * 24;
    if (endH <= startH) endH += 168;

    const etbDay = dayIndex(row.etbDay);
    const prof = proformaVolume(row);
    const exp = effectiveVolume(row);
    const svcKey = String(row.service).trim().toUpperCase();
    const tier = tierOf.get(svcKey) || 'small';
    const occupation = Number(en.occupation) || Number(row.loa) || 0;

    days[etbDay].arrivalsProforma += prof;
    days[etbDay].arrivalsExpected += exp;
    days[etbDay].tierExpected[tier] += exp;
    days[etbDay].byServiceExpected[svcKey] =
      (days[etbDay].byServiceExpected[svcKey] || 0) + exp;

    for (let d = 0; d < 7; d++) {
      const dayStart = d * 24;
      const dayEnd = dayStart + 24;
      // overlap of [startH,endH] with day (also +168 wrap already in endH)
      const overlaps = [];
      // primary week segment
      const a = Math.max(startH, dayStart);
      const b = Math.min(endH, dayEnd);
      if (b > a) overlaps.push(b - a);
      // if stay wraps past 168 into next week copy within same weekly profile
      if (endH > 168) {
        const a2 = Math.max(startH - 168, dayStart);
        const b2 = Math.min(endH - 168, dayEnd);
        if (b2 > a2) overlaps.push(b2 - a2);
      }
      const hoursOnDay = overlaps.reduce((s, x) => s + x, 0);
      if (hoursOnDay > 0) {
        days[d].concurrentMeters += occupation;
        days[d].mhLoad += occupation * hoursOnDay;
        days[d].callsPresent += 1;
      }
    }
  }

  let cumProf = 0;
  let cumExp = 0;
  let cumMh = 0;
  let cumLarge = 0;
  let cumMedium = 0;
  let cumSmall = 0;
  const cumByService = {};

  return days.map((d) => {
    cumProf += d.arrivalsProforma;
    cumExp += d.arrivalsExpected;
    cumMh += d.mhLoad;
    cumLarge += d.tierExpected.large;
    cumMedium += d.tierExpected.medium;
    cumSmall += d.tierExpected.small;
    for (const [k, v] of Object.entries(d.byServiceExpected || {})) {
      cumByService[k] = (cumByService[k] || 0) + (v || 0);
    }
    return {
      ...d,
      byServiceExpected: { ...(d.byServiceExpected || {}) },
      cumulativeProforma: cumProf,
      cumulativeExpected: cumExp,
      cumulativeMh: cumMh,
      cumulativeTier: {
        large: cumLarge,
        medium: cumMedium,
        small: cumSmall,
      },
      cumulativeByService: { ...cumByService },
    };
  });
}

/** Scale a weekly daily series into period-length points for area charts. */
export function expandSeriesForPeriod(weeklySeries, period, terminal) {
  if (period === 'week' || !weeklySeries?.length) return weeklySeries || [];

  const weekSum = weeklySeries.reduce(
    (acc, d) => {
      acc.arrivalsProforma += d.arrivalsProforma;
      acc.arrivalsExpected += d.arrivalsExpected;
      acc.mhLoad += d.mhLoad;
      acc.concurrentMeters += d.concurrentMeters;
      acc.tierExpected.large += d.tierExpected.large;
      acc.tierExpected.medium += d.tierExpected.medium;
      acc.tierExpected.small += d.tierExpected.small;
      for (const [k, v] of Object.entries(d.byServiceExpected || {})) {
        acc.byServiceExpected[k] = (acc.byServiceExpected[k] || 0) + (v || 0);
      }
      return acc;
    },
    {
      arrivalsProforma: 0,
      arrivalsExpected: 0,
      mhLoad: 0,
      concurrentMeters: 0,
      tierExpected: { large: 0, medium: 0, small: 0 },
      byServiceExpected: {},
    }
  );

  // Month: keep daily resolution across ~4 weeks (pattern repeat)
  if (period === 'month') {
    const weeks = Math.max(1, Math.round(periodWeeks(period, terminal)));
    const out = [];
    for (let w = 0; w < weeks; w++) {
      for (const d of weeklySeries) {
        out.push({
          ...d,
          byServiceExpected: { ...(d.byServiceExpected || {}) },
          key: `${w + 1}-${d.key}`,
          weekIndex: w,
        });
      }
    }
    return accumulateSeries(out);
  }

  // Quarter / year: one point per week (cleaner, scientifically aggregated)
  const n = Math.max(1, Math.round(periodWeeks(period, terminal)));
  const points = Array.from({ length: n }, (_, i) => ({
    key: `W${i + 1}`,
    index: i,
    arrivalsProforma: weekSum.arrivalsProforma,
    arrivalsExpected: weekSum.arrivalsExpected,
    concurrentMeters: weekSum.concurrentMeters / 7,
    mhLoad: weekSum.mhLoad,
    callsPresent: 0,
    tierExpected: { ...weekSum.tierExpected },
    byServiceExpected: { ...(weekSum.byServiceExpected || {}) },
  }));
  return accumulateSeries(points);
}

function accumulateSeries(points) {
  let cumProf = 0;
  let cumExp = 0;
  let cumMh = 0;
  let cumLarge = 0;
  let cumMedium = 0;
  let cumSmall = 0;
  const cumByService = {};
  return points.map((d) => {
    cumProf += d.arrivalsProforma;
    cumExp += d.arrivalsExpected;
    cumMh += d.mhLoad;
    cumLarge += d.tierExpected.large;
    cumMedium += d.tierExpected.medium;
    cumSmall += d.tierExpected.small;
    const svcMap = d.byServiceExpected || {};
    for (const [k, v] of Object.entries(svcMap)) {
      cumByService[k] = (cumByService[k] || 0) + (v || 0);
    }
    return {
      ...d,
      byServiceExpected: { ...svcMap },
      cumulativeProforma: cumProf,
      cumulativeExpected: cumExp,
      cumulativeMh: cumMh,
      cumulativeTier: { large: cumLarge, medium: cumMedium, small: cumSmall },
      cumulativeByService: { ...cumByService },
    };
  });
}

/**
 * Full executive dashboard snapshot for the terminal.
 */
export function buildDashboard({
  services = [],
  terminal = {},
  metrics = {},
  equipment = {},
  lockZones = [],
  cranes = [],
  period = 'week',
}) {
  const berth = calcBerthCapacity({ services, terminal, metrics, lockZones });
  const equip = calcEquipmentCapacity(equipment);
  const byService = aggregateByService(services, berth.services);

  const callsWeek = services.filter((s) => s?.service).length;
  const proformaMovesWeek = services.reduce((s, r) => s + proformaVolume(r), 0);
  const expectedMovesWeek = services.reduce((s, r) => s + effectiveVolume(r), 0);
  const vesselsNamed = services.filter((s) => s?.vesselName).length;

  const avgLoa =
    callsWeek > 0 ? services.reduce((s, r) => s + (Number(r.loa) || 0), 0) / callsWeek : 0;
  const avgOccupation =
    berth.services.length > 0
      ? berth.services.reduce((s, r) => s + (Number(r.occupation) || 0), 0) / berth.services.length
      : 0;
  const avgPmph =
    berth.services.length > 0
      ? berth.services.reduce((s, r) => {
          const vol = effectiveVolume(r);
          const stay = Number(r.netPortstay) || 0;
          return s + (stay > 0 ? vol / stay : 0);
        }, 0) / berth.services.length
      : 0;
  const avgCraneDensity =
    berth.services.length > 0
      ? berth.services.reduce((s, r) => s + (Number(r.craneDensity) || 0), 0) / berth.services.length
      : 0;
  const totalBerthHours = berth.services.reduce((s, r) => s + (Number(r.berthHours) || 0), 0);
  const totalNetPortstay = berth.services.reduce((s, r) => s + (Number(r.netPortstay) || 0), 0);

  const weeks = periodWeeks(period, terminal);
  const expectedMoves = expectedMovesWeek * weeks;
  const proformaMoves = proformaMovesWeek * weeks;
  const bargeMoves = (berth.bargeVolume || 0) * weeks;
  const totalMoves = expectedMoves + bargeMoves;

  const stsCapacityYear = Number(equip.quayMoves) || 0;
  const cyCapacityYear = Number(equip.cyEqCapacity) || 0;
  const weeksYear = Number(terminal.workingWeeksPerYear) || 52;
  const stsDemandYear = expectedMovesWeek * weeksYear;

  const quay = Number(terminal.quayLength) || 0;
  const craneCount = (cranes || []).length || Number(terminal.stsCount) || 0;
  const craneMphAvg =
    craneCount > 0
      ? (cranes || []).reduce((s, c) => s + (Number(c.mph) || 0), 0) / craneCount
      : Number(metrics.vesselCmph) || 28;

  const lockLostWeek = berth.lockZonesLostMeterHoursWeek || lockZonesLostMeterHoursWeek(lockZones, quay);
  const lockLost = lockLostWeek * weeks;

  const serviceShare = byService.map((r) => ({
    ...r,
    expectedMovesPeriod: r.expectedMoves * weeks,
    proformaMovesPeriod: r.proformaMoves * weeks,
    meterHoursPeriod: r.meterHours * weeks,
    sharePct: expectedMovesWeek > 0 ? r.expectedMoves / expectedMovesWeek : 0,
  }));

  const customers = classifyCustomerTiers(serviceShare.map((r) => ({
    ...r,
    expectedMoves: r.expectedMovesPeriod,
    proformaMoves: r.proformaMovesPeriod,
    meterHours: r.meterHoursPeriod,
  })));

  const weeklySeries = buildWeeklyTimeSeries(services, berth.services, byService);
  const timeSeries =
    period === 'week'
      ? weeklySeries
      : expandSeriesForPeriod(weeklySeries, period, terminal);

  return {
    period,
    weeksInPeriod: weeks,
    berth,
    equip,
    byService: serviceShare,
    customers,
    timeSeries,
    weeklySeries,
    kpis: {
      bu: berth.berthUtilization,
      calls: callsWeek * weeks,
      callsWeek,
      vesselsNamed,
      vesselsNamedPct: callsWeek > 0 ? vesselsNamed / callsWeek : 0,
      proformaMoves,
      expectedMoves,
      varianceMoves: expectedMoves - proformaMoves,
      variancePct: proformaMoves > 0 ? (expectedMoves - proformaMoves) / proformaMoves : 0,
      bargeMoves,
      totalMoves,
      avgLoa,
      avgOccupation,
      avgPmph,
      avgCraneDensity,
      totalBerthHours: totalBerthHours * weeks,
      totalNetPortstay: totalNetPortstay * weeks,
      availableMh: berth.availableMeterHoursWeek * weeks,
      proformaMh: berth.proformaMeterHoursWeek * weeks,
      lockLostMh: lockLost,
      quayLength: quay,
      craneCount,
      craneMphAvg,
      stsCapacityYear,
      cyCapacityYear,
      stsDemandYear,
      stsUtilization: stsCapacityYear > 0 ? stsDemandYear / stsCapacityYear : 0,
      cyDemandYear: Number(equip.totalYardMoves) || stsDemandYear,
      cyUtilization:
        cyCapacityYear > 0 ? (Number(equip.totalYardMoves) || 0) / cyCapacityYear : 0,
      gateMovesDesigned: Number(equipment.gateMovesDesigned) || 0,
      serviceLines: byService.length,
      mhUtilization:
        berth.availableMeterHoursWeek > 0
          ? berth.proformaMeterHoursWeek / berth.availableMeterHoursWeek
          : 0,
    },
  };
}

/** Sort services by ETB for operational call list. */
export function sortedCalls(services = []) {
  return [...services]
    .filter((s) => s?.service)
    .sort((a, b) => {
      const sa = dayIndex(a.etbDay) + toDayFraction(a.etbTime);
      const sb = dayIndex(b.etbDay) + toDayFraction(b.etbTime);
      return sa - sb;
    })
    .map((s) => ({
      ...s,
      proformaMoves: proformaVolume(s),
      expectedMoves: effectiveVolume(s),
    }));
}
