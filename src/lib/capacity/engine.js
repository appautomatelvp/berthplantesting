/**
 * Berth capacity calculation engine
 * Derived from Berthing Window Excel model (meter-hour method).
 *
 * Core idea:
 *   MeterHours = BerthOccupation(m) × BerthHours(h)
 *   BerthOccupation = LOA + mooringFore + mooringAft
 *   mooring = min(LOA × 10%, mooringCap)
 *   BerthHours = arrivalManeuver + departureManeuver + netPortstay
 *   Berth Utilization = ProformaMeterHours / AvailableMeterHours
 */

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Excel time serial (fraction of day) or "HH:mm" / number hours → day fraction 0–1 */
export function toDayFraction(time) {
  if (time == null || time === '') return 0;
  if (typeof time === 'number') {
    if (time >= 0 && time < 1) return time; // already Excel serial
    if (time >= 1 && time <= 24) return time / 24; // hours
    return time;
  }
  const s = String(time).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return (Number(m[1]) + Number(m[2]) / 60) / 24;
  const n = Number(s);
  return Number.isFinite(n) ? toDayFraction(n) : 0;
}

export function dayIndex(day) {
  if (day == null) return 0;
  const key = String(day).trim().slice(0, 3);
  const i = DAYS.findIndex((d) => d.toLowerCase() === key.toLowerCase());
  return i >= 0 ? i : 0;
}

/** Net portstay in hours between ETB and ETD on a weekly cycle (wraps Sun→Mon). */
export function netPortstayHours(etbDay, etbTime, etdDay, etdTime) {
  const start = dayIndex(etbDay) + toDayFraction(etbTime);
  let end = dayIndex(etdDay) + toDayFraction(etdTime);
  if (end < start) end += 7;
  return (end - start) * 24;
}

export function mooringLength(loa, mooringCap = 30, mooringRatio = 0.1) {
  const L = Number(loa) || 0;
  return Math.min(L * mooringRatio, mooringCap);
}

export function berthOccupation(loa, mooringCap = 30, mooringRatio = 0.1) {
  const L = Number(loa) || 0;
  const m = mooringLength(L, mooringCap, mooringRatio);
  return L + m + m;
}

/** Enrich one mainline / feeder service row with derived metrics. */
export function calcService(row, defaults = {}) {
  const {
    arrivalHrs = 1,
    departureHrs = 1,
    cmph = 28,
    mooringCap = 30,
    mooringRatio = 0.1,
  } = defaults;

  const loa = Number(row.loa) || 0;
  const volume = Number(row.volume) || 0;
  const expectedVolume =
    row.expectedVolume != null && row.expectedVolume !== '' && Number.isFinite(Number(row.expectedVolume))
      ? Math.max(0, Number(row.expectedVolume))
      : volume;
  const arrival = row.arrivalHrs != null ? Number(row.arrivalHrs) : arrivalHrs;
  const departure = row.departureHrs != null ? Number(row.departureHrs) : departureHrs;
  const serviceCmph = row.cmph != null ? Number(row.cmph) : cmph;

  const mooring1 = mooringLength(loa, mooringCap, mooringRatio);
  const mooring2 = mooring1;
  const occupation = loa + mooring1 + mooring2;

  const netPortstay =
    row.etbDay != null && row.etdDay != null
      ? netPortstayHours(row.etbDay, row.etbTime, row.etdDay, row.etdTime)
      : Number(row.netPortstay) || 0;

  const berthHours = arrival + departure + netPortstay;
  const meterHours = berthHours * occupation;
  const pmph = netPortstay > 0 ? expectedVolume / netPortstay : 0;
  const craneDensity = serviceCmph > 0 ? pmph / serviceCmph : 0;

  return {
    ...row,
    loa,
    volume,
    expectedVolume,
    vesselName: row.vesselName || '',
    arrivalHrs: arrival,
    departureHrs: departure,
    cmph: serviceCmph,
    mooring1,
    mooring2,
    occupation,
    netPortstay,
    berthHours,
    meterHours,
    pmph,
    craneDensity,
  };
}

/** Aggregate barge demand derived from mainline volume (Excel BARGE row). */
export function calcBargeBlock(services, metrics) {
  const {
    bargeVesselVolumeRatio = 0.63,
    bargeCallsPerWeek = 150,
    bargeLoa = 75,
    bargeCmph = 29,
    bargeArrivalHrs = 0.5,
    bargeDepartureHrs = 0,
    mooringCap = 30,
    mooringRatio = 0.1,
  } = metrics;

  const mainlineVolume = services.reduce((s, r) => s + (Number(r.volume) || 0), 0);
  const volume = mainlineVolume * bargeVesselVolumeRatio;
  const occupation = berthOccupation(bargeLoa, mooringCap, mooringRatio);
  const netPortstay =
    bargeCmph > 0 && bargeCallsPerWeek > 0 ? volume / bargeCmph / bargeCallsPerWeek : 0;
  const berthHours = bargeArrivalHrs + bargeDepartureHrs + netPortstay;
  const meterHours = berthHours * occupation * bargeCallsPerWeek;

  return {
    service: 'BARGE',
    loa: bargeLoa,
    volume,
    callsPerWeek: bargeCallsPerWeek,
    cmph: bargeCmph,
    arrivalHrs: bargeArrivalHrs,
    departureHrs: bargeDepartureHrs,
    occupation,
    netPortstay,
    berthHours,
    meterHours,
  };
}

export function availableMeterHoursYear(terminal) {
  const quay = Number(terminal.quayLength) || 0;
  const days = Number(terminal.workingDaysPerYear) || 365;
  const hours = Number(terminal.workingHoursPerDay) || 24;
  return quay * days * hours;
}

export function availableMeterHoursWeek(terminal) {
  const quay = Number(terminal.quayLength) || 0;
  const hours = Number(terminal.workingHoursPerDay) || 24;
  const daysPerWeek = Number(terminal.workingDaysPerWeek) || 7;
  return quay * daysPerWeek * hours;
}

/** MH lost in a week from lock zones (reduced remaining capacityPct). */
export function lockZonesLostMeterHoursWeek(zones, quayLength) {
  const L = Math.max(1, Number(quayLength) || 600);
  return (zones || []).reduce((sum, z) => {
    const lengthM = Math.max(1, Math.min(L, Number(z.lengthM) || 0));
    const capacityPct = Math.max(0, Math.min(100, Number(z.capacityPct) ?? 0));
    let start = (dayIndex(z.etbDay) + toDayFraction(z.etbTime)) * 24;
    let end = (dayIndex(z.etdDay) + toDayFraction(z.etdTime)) * 24;
    if (end <= start) end += 168;
    const hours = Math.max(0, end - start);
    return sum + lengthM * hours * (1 - capacityPct / 100);
  }, 0);
}

/**
 * Full capacity rollup — mirrors Excel "Berth Capacity" summary panel.
 * BU uses weekly MH / (quay × daysPerWeek × hoursPerDay)
 * which is equivalent to annual MH / (quay × days/year × hours/day).
 * Lock zones reduce available MH by length × hours × (1 − capacityPct/100).
 */
export function calcBerthCapacity({ services = [], terminal = {}, metrics = {}, lockZones = [] }) {
  const serviceDefaults = {
    arrivalHrs: metrics.vesselArrivalHrs ?? 1,
    departureHrs: metrics.vesselDepartureHrs ?? 1,
    cmph: metrics.vesselCmph ?? 28,
    mooringCap: metrics.mooringCap ?? 30,
    mooringRatio: metrics.mooringRatio ?? 0.1,
  };

  const enriched = services
    .filter((s) => s && s.service)
    .map((s) => calcService(s, serviceDefaults));

  const barge = calcBargeBlock(enriched, {
    ...metrics,
    mooringCap: serviceDefaults.mooringCap,
    mooringRatio: serviceDefaults.mooringRatio,
  });

  const mainlineMeterHours = enriched.reduce((s, r) => s + r.meterHours, 0);
  const bargeMeterHours = barge.meterHours;
  const proformaMeterHoursWeek = mainlineMeterHours + bargeMeterHours;

  const weeks = Number(terminal.workingWeeksPerYear) || 52;
  const quay = Number(terminal.quayLength) || 0;
  const lostWeek = lockZonesLostMeterHoursWeek(lockZones, quay);
  const availableWeekRaw = availableMeterHoursWeek(terminal);
  const availableWeek = Math.max(0, availableWeekRaw - lostWeek);
  const availableYear = Math.max(0, availableMeterHoursYear(terminal) - lostWeek * weeks);

  const berthUtilization =
    availableWeek > 0 ? proformaMeterHoursWeek / availableWeek : 0;

  const mainlineVolume = enriched.reduce((s, r) => s + r.volume, 0);
  const totalVolumeWeek = mainlineVolume + barge.volume;
  const adhocMh = enriched
    .filter((s) => s.lineKind === 'adhoc')
    .reduce((s, r) => s + r.meterHours, 0);
  const adhocVol = enriched
    .filter((s) => s.lineKind === 'adhoc')
    .reduce((s, r) => s + r.volume, 0);
  const annualVolumeAtProforma = (totalVolumeWeek - adhocVol) * weeks + adhocVol;

  return {
    services: enriched,
    barge,
    mainlineMeterHours,
    bargeMeterHours,
    proformaMeterHoursWeek,
    proformaMeterHoursYear: (proformaMeterHoursWeek - adhocMh) * weeks + adhocMh,
    availableMeterHoursWeek: availableWeek,
    availableMeterHoursYear: availableYear,
    lockZonesLostMeterHoursWeek: lostWeek,
    berthUtilization,
    mainlineVolume,
    bargeVolume: barge.volume,
    totalVolumeWeek,
    annualVolumeAtProforma,
  };
}

/** STS / yard equipment capacity (Excel "CY Equiment"). */
export function calcEquipmentCapacity(equip) {
  const rows = (equip?.fleet || []).map((e) => {
    const cmph = Number(e.cmph) || 0;
    const count = Number(e.count) || 0;
    const hrs = Number(e.availableHrsPerYear) || 8760;
    const availability = Number(e.availability) || 0;
    const utilization = Number(e.utilization) || 0;
    const capacity = cmph * count * hrs * availability * utilization;
    return { ...e, capacity };
  });

  const byType = Object.fromEntries(rows.map((r) => [r.type, r]));
  const sts = byType.STS?.capacity || 0;
  const rtg = byType.RTG?.capacity || 0;
  const rs = byType.RS?.capacity || 0;
  const eh = byType.EH?.capacity || 0;

  const quayMoves = sts;
  const gateMoves = Number(equip?.gateMovesDesigned) || 0;
  const rehandleRatio = Number(equip?.rehandleRatio) ?? 0.1;
  const rehandleMoves = quayMoves * rehandleRatio;
  const totalYardMoves = quayMoves + gateMoves + rehandleMoves;
  const cyEqCapacity = rtg + rs + eh;

  return {
    fleet: rows,
    quayMoves,
    gateMoves,
    rehandleMoves,
    totalYardMoves,
    cyEqCapacity,
    bottleneckMoves: Math.min(quayMoves || Infinity, cyEqCapacity || Infinity),
  };
}

export function classifyBor(bu, bands) {
  const pct = bu * 100;
  for (const b of bands) {
    const min = b.minPct ?? -Infinity;
    const max = b.maxPct ?? Infinity;
    if (pct >= min && pct < max) return b;
  }
  return bands[bands.length - 1] || null;
}
