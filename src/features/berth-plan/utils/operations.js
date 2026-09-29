/**
 * V1 operational logic shared by the guide, dashboard, berth plan, and external berths.
 * Meter-hours stay on the same definitions as the capacity engine.
 *
 * Available capacity = quay Ã— hours âˆ’ maintenance downtime
 * Mother vessels are placed first
 * Barge windows fill leftover meter-time gaps
 * Spill-over suggests an external berth when BOR or anchorage exposure crosses the trigger
 */

import {
  berthOccupation,
  dayIndex,
  netPortstayHours,
  toDayFraction,
} from '../../capacity/utils/engine.js';
import { layoutLockZones } from '../../../shared/utils/lockZone.js';

export const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DEFAULT_THRESHOLDS = {
  borAlertPct: 75,
  borSpillPct: 85,
  waitingTriggerHrs: 12,
  delayPenaltyVndPerHour: 45000000,
  unplannedBreakdownPct: 2,
};

export function thresholdsOf(metrics = {}) {
  return {
    borAlertPct: Number(metrics.borAlertPct ?? DEFAULT_THRESHOLDS.borAlertPct),
    borSpillPct: Number(metrics.borSpillPct ?? DEFAULT_THRESHOLDS.borSpillPct),
    waitingTriggerHrs: Number(metrics.waitingTriggerHrs ?? DEFAULT_THRESHOLDS.waitingTriggerHrs),
    delayPenaltyVndPerHour: Number(
      metrics.delayPenaltyVndPerHour ?? DEFAULT_THRESHOLDS.delayPenaltyVndPerHour
    ),
    unplannedBreakdownPct: Number(
      metrics.unplannedBreakdownPct ?? DEFAULT_THRESHOLDS.unplannedBreakdownPct
    ),
  };
}

function unitMix(seed) {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

/** Â±percent for a repeated fixed line. Week 0 stays on the proforma the user typed. */
export function repeatSwing(weekIndex, pct) {
  const p = Math.min(100, Math.max(0, Number(pct) || 0)) / 100;
  if (!weekIndex || p <= 0) return 1;
  const sign = weekIndex % 2 === 0 ? 1 : -1;
  return 1 + sign * p;
}

/** Park a vessel against wharf mark 0 (upstream) or the current quay end (downstream). */
export function placeAlongQuay(side, intervals, occupation, quayLength) {
  const occ = Math.max(1, Number(occupation) || 1);
  const quay = Math.max(occ, Number(quayLength) || occ);
  const fits = (intervals || []).filter((iv) => iv.b - iv.a >= occ - 0.01);
  if (!fits.length) {
    return {
      from: side === 'upstream' ? 0 : Math.max(0, quay - occ),
      assigned: false,
    };
  }
  if (side === 'upstream') {
    fits.sort((a, b) => a.a - b.a || a.b - b.b);
    return { from: fits[0].a, assigned: true };
  }
  fits.sort((a, b) => b.b - a.b || b.a - a.a);
  return { from: Math.max(fits[0].a, fits[0].b - occ), assigned: true };
}

function subtractUsed(intervals, used) {
  let iv = intervals.map((x) => ({ ...x }));
  for (const u of [...used].sort((a, b) => a.a - b.a)) {
    const next = [];
    for (const seg of iv) {
      if (u.b <= seg.a + 0.01 || u.a >= seg.b - 0.01) {
        next.push(seg);
        continue;
      }
      if (u.a > seg.a + 0.01) next.push({ a: seg.a, b: Math.min(seg.b, u.a) });
      if (u.b < seg.b - 0.01) next.push({ a: Math.max(seg.a, u.b), b: seg.b });
    }
    iv = next.filter((s) => s.b - s.a > 0.5);
  }
  return iv;
}

/**
 * Place mother-vessel occupations on the quay.
 * Full maintenance blocks (remaining capacity 0%) are treated as occupied
 * so automatic placement does not draw a vessel into a closed stretch.
 */
export function layoutMotherVessels(services, quayLength, weeks = 1, obstacles = []) {
  const quay = Math.max(50, Number(quayLength) || 600);
  const sorted = [...(services || [])].sort((a, b) => {
    const sa = dayIndex(a.etbDay) + toDayFraction(a.etbTime);
    const sb = dayIndex(b.etbDay) + toDayFraction(b.etbTime);
    return sa - sb;
  });

  const placed = [];
  for (let w = 0; w < weeks; w++) {
    const lanes = [];
    const offset = w * 168;
    for (const svc of sorted) {
      if (w > 0 && svc.lineKind === 'adhoc') continue;
      let start = (dayIndex(svc.etbDay) + toDayFraction(svc.etbTime)) * 24 + offset;
      let end = (dayIndex(svc.etdDay) + toDayFraction(svc.etdTime)) * 24 + offset;
      if (end <= start) end += 168;
      if (w > 0 && svc.lineKind !== 'adhoc') {
        const swing = repeatSwing(w, svc.timeChangePct);
        if (swing !== 1) end = start + Math.max(0.5, (end - start) * swing);
      }

      const occ = Number(svc.occupation) || Number(svc.loa) || 0;
      let from;
      let assigned = true;

      const blocked = [];
      for (const lane of lanes) {
        if (!(end <= lane.startHour || start >= lane.endHour)) {
          blocked.push({ a: lane.fromMeter, b: lane.fromMeter + lane.occ });
        }
      }
      for (const ob of obstacles || []) {
        const os = Number(ob.startHour) + offset;
        const oe = Number(ob.endHour) + offset;
        if (!(end <= os || start >= oe)) blocked.push({ a: ob.fromMeter, b: ob.toMeter });
      }

      const manual =
        svc.berthManual && svc.berthStart != null && Number.isFinite(Number(svc.berthStart));
      const side =
        svc.berthSide === 'upstream' || svc.berthSide === 'downstream' ? svc.berthSide : null;
      if (manual) {
        from = Math.max(0, Math.min(quay - occ, Number(svc.berthStart)));
      } else if (side) {
        const intervals = subtractUsed([{ a: 0, b: quay }], blocked);
        const parked = placeAlongQuay(side, intervals, occ, quay);
        from = parked.from;
        assigned = parked.assigned;
      } else if (svc.berthStart != null && Number.isFinite(Number(svc.berthStart))) {
        from = Math.max(0, Math.min(quay - occ, Number(svc.berthStart)));
      } else {
        const intervals = subtractUsed([{ a: 0, b: quay }], blocked);
        const fit = intervals
          .filter((iv) => iv.b - iv.a >= occ)
          .sort((x, y) => y.b - x.b)[0];
        if (fit) from = fit.b - occ;
        else {
          from = Math.max(0, quay - occ);
          assigned = false;
        }
      }

      const toMeter = from + occ;
      const localStart = start - offset;
      const localEnd = end - offset;
      const weekEnd = offset + 168;
      const spans = [
        localEnd <= 168.001
          ? { startHour: offset + localStart, endHour: offset + localEnd, segment: 'whole' }
          : null,
        localEnd > 168.001
          ? { startHour: offset + localStart, endHour: weekEnd, segment: 'head' }
          : null,
        localEnd > 168.001
          ? { startHour: offset, endHour: offset + (localEnd - 168), segment: 'tail' }
          : null,
      ].filter(Boolean);

      spans.forEach((span) => {
        const spanStart = span.startHour;
        const spanEnd = span.endHour;
        const maintenanceConflict = (obstacles || []).some((ob) => {
          const os = Number(ob.startHour) + offset;
          const oe = Number(ob.endHour) + offset;
          const time = !(spanEnd <= os || spanStart >= oe);
          const meter = !(toMeter <= ob.fromMeter || from >= ob.toMeter);
          return time && meter;
        });
        const quayOverflow = !assigned || from < 0 || toMeter > quay + 0.01;
        const hasOverlap = lanes.some(
          (l) =>
            !(spanEnd <= l.startHour || spanStart >= l.endHour) &&
            !(toMeter <= l.fromMeter || from >= l.fromMeter + l.occ)
        );

        const volumeSwing = w > 0 && svc.lineKind !== 'adhoc' ? repeatSwing(w, svc.volumeChangePct) : 1;
        const swungMoves =
          volumeSwing === 1
            ? svc.expectedVolume
            : Math.max(0, Math.round((Number(svc.volume) || 0) * volumeSwing));
        placed.push({
          ...svc,
          expectedVolume: swungMoves,
          kind: 'mother',
          weekIndex: w,
          segment: span.segment,
          key: `${svc.id || svc.service}-w${w}-${span.segment}`,
          localStart,
          localEnd,
          startHour: spanStart,
          endHour: spanEnd,
          fromMeter: from,
          toMeter,
          hasOverlap,
          quayOverflow,
          maintenanceConflict,
          overflow: quayOverflow || hasOverlap || maintenanceConflict,
        });
        lanes.push({ startHour: spanStart, endHour: spanEnd, fromMeter: from, occ });
      });
    }
  }
  return placed;
}

function weekLocalObstacles(lockZones, quay) {
  return layoutLockZones(lockZones || [], quay, 1)
    .filter((z) => (Number(z.capacityPct) ?? 0) <= 0)
    .map((z) => ({
      startHour: z.startHour,
      endHour: z.endHour,
      fromMeter: z.fromMeter,
      toMeter: z.toMeter,
    }));
}

/** True when a week-local vessel box cuts a fully closed maintenance block. */
export function overlapsMaintenance(startHour, endHour, fromMeter, occupation, lockZones, quay) {
  const to = fromMeter + occupation;
  return weekLocalObstacles(lockZones, quay).some((ob) => {
    const time = !(endHour <= ob.startHour || startHour >= ob.endHour);
    const meter = !(to <= ob.fromMeter || fromMeter >= ob.toMeter);
    return time && meter;
  });
}

/** A contiguous free stretch is a barge window from this width upward. */
export const BARGE_WINDOW_MIN_METERS = 73;
/** A time band is a barge window only when it runs longer than 90 minutes. */
export const BARGE_WINDOW_MIN_HOURS = 1.5;

function snapHour(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function sameMeterRange(left, right) {
  return Math.abs(left.a - right.a) < 0.5 && Math.abs(left.b - right.b) < 0.5;
}

/**
 * Scan the week from top to bottom. Each time band keeps a constant set of
 * mother vessels and fully closed maintenance. Inside that band, every
 * contiguous leftover of quay at least 73 m is its own barge window.
 * When a vessel starts or finishes, the band is cut and the next leftovers
 * become new cells, so the gap under a ship is one full-width rectangle.
 */
export function planBargeWindows({
  blocks,
  lockBlocks,
  quayLength,
  minWidth = BARGE_WINDOW_MIN_METERS,
  minHours = BARGE_WINDOW_MIN_HOURS,
} = {}) {
  const quay = Math.max(50, Number(quayLength) || 600);
  const width = Math.max(1, Math.min(quay, Number(minWidth) || BARGE_WINDOW_MIN_METERS));
  const minSpan = Number(minHours) > 0 ? Number(minHours) : BARGE_WINDOW_MIN_HOURS;

  const obstacles = [
    ...(blocks || []).filter((b) => (b.weekIndex ?? 0) === 0),
    ...(lockBlocks || []).filter((z) => (z.weekIndex ?? 0) === 0 && (Number(z.capacityPct) ?? 0) <= 0),
  ]
    .map((b) => ({
      start: snapHour(Math.max(0, Math.min(168, Number(b.startHour) || 0))),
      end: snapHour(Math.max(0, Math.min(168, Number(b.endHour) || 0))),
      a: Math.max(0, Math.min(quay, Number(b.fromMeter) || 0)),
      b: Math.max(0, Math.min(quay, Number(b.toMeter) || 0)),
    }))
    .filter((b) => b.end > b.start && b.b > b.a + 0.01);

  const times = new Set([0, 168]);
  for (const ob of obstacles) {
    times.add(ob.start);
    times.add(ob.end);
  }
  const marks = [...times].sort((x, y) => x - y);

  const slices = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const t0 = marks[i];
    const t1 = marks[i + 1];
    if (t1 <= t0) continue;
    const used = obstacles
      .filter((ob) => ob.start < t1 && ob.end > t0)
      .map((ob) => ({ a: ob.a, b: ob.b }));
    const free = subtractUsed([{ a: 0, b: quay }], used).filter((iv) => iv.b - iv.a >= width - 0.01);
    for (const iv of free) slices.push({ a: iv.a, b: iv.b, start: t0, end: t1 });
  }

  slices.sort((p, q) => p.a - q.a || p.b - q.b || p.start - q.start);
  const merged = [];
  for (const slice of slices) {
    const prev = merged[merged.length - 1];
    if (prev && sameMeterRange(prev, slice) && Math.abs(prev.end - slice.start) < 0.02) {
      prev.end = slice.end;
    } else {
      merged.push({ ...slice });
    }
  }

  return merged
    .filter((r) => r.end - r.start > minSpan && r.b - r.a >= width - 0.01)
    .sort((a, b) => a.start - b.start || a.a - b.a)
    .map((r, i) => ({
      id: `bw${i}`,
      kind: 'barge',
      fromMeter: r.a,
      toMeter: r.b,
      startHour: r.start,
      endHour: r.end,
    }));
}

/** Plan each displayed week from the vessels actually berthed that week. */
export function planBargeWindowsByWeek({ blocks, lockBlocks, quayLength, weeks }) {
  const n = Math.max(1, weeks || 1);
  const out = [];
  for (let w = 0; w < n; w++) {
    const localBlocks = (blocks || [])
      .filter((b) => (b.weekIndex ?? 0) === w)
      .map((b) => ({
        ...b,
        weekIndex: 0,
        startHour: b.startHour - w * 168,
        endHour: b.endHour - w * 168,
      }));
    const windows = planBargeWindows({ blocks: localBlocks, lockBlocks, quayLength });
    windows.forEach((win, index) => {
      out.push({
        ...win,
        id: `${win.id}-w${w}`,
        key: `bw${w}-${index}`,
        weekIndex: w,
        startHour: win.startHour + w * 168,
        endHour: win.endHour + w * 168,
      });
    });
  }
  return out;
}

function clockToHour(value) {
  const [hh, mm] = String(value || '00:00').split(':').map(Number);
  return (Number(hh) || 0) + (Number(mm) || 0) / 60;
}

function shiftIndexAt(hourOfDay, spans) {
  for (let i = 0; i < spans.length; i += 1) {
    const { start, end } = spans[i];
    if (end > start) {
      if (hourOfDay >= start && hourOfDay < end) return i;
    } else if (hourOfDay >= start || hourOfDay < end) return i;
  }
  return -1;
}

/** How many barge calls fit inside geometric barge windows, by day and by named shift. */
export function bargeCapacityFromWindows(windows, callHours, occupation, shifts = []) {
  const hrs = Math.max(0.25, Number(callHours) || 1);
  const occ = Math.max(1, Number(occupation) || 1);
  const byDay = DAY_KEYS.map((key) => ({ key, calls: 0 }));
  const spans = (shifts || []).map((row) => ({
    ...row,
    start: clockToHour(row.start),
    end: clockToHour(row.end),
    calls: 0,
  }));
  let calls = 0;
  for (const w of windows || []) {
    const parallel = Math.floor((w.toMeter - w.fromMeter) / occ);
    if (parallel < 1) continue;
    let t = w.startHour;
    while (t + hrs <= w.endHour + 0.001) {
      calls += parallel;
      const local = ((t % 168) + 168) % 168;
      const day = Math.min(6, Math.floor(local / 24));
      byDay[day].calls += parallel;
      const shift = shiftIndexAt(local % 24, spans);
      if (shift >= 0) spans[shift].calls += parallel;
      t += hrs;
    }
  }
  return { callsPerWeek: calls, byDay, byShift: spans };
}

/** One live week plus repeated weeks that do not include one-off ad hoc calls. */
export function bargeCapacityHorizon(live, repeat, weeks) {
  const extra = Math.max(0, Number(weeks) - 1);
  return {
    calls: (live?.callsPerWeek || 0) + (repeat?.callsPerWeek || 0) * extra,
    byShift: (live?.byShift || []).map((row, index) => ({
      ...row,
      calls: row.calls + (repeat?.byShift?.[index]?.calls || 0) * extra,
    })),
  };
}

function overlapHours(a0, a1, b0, b1) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function dailyFromBlocks(blocks, valueOf) {
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const b of blocks || []) {
    if ((b.weekIndex ?? 0) !== 0) continue;
    for (let d = 0; d < 7; d++) {
      const hours = overlapHours(b.startHour, b.endHour, d * 24, (d + 1) * 24);
      if (hours > 0) days[d] += valueOf(b, hours);
    }
  }
  return days;
}

export function borBand(bor) {
  const pct = bor * 100;
  if (pct >= 75) return 'hot';
  if (pct >= 60) return 'warm';
  return 'cool';
}

export function buildBorHeatmap({ motherBlocks, bargeMeterHoursWeek = 0, lockZones, terminal, period }) {
  const quay = Math.max(1, Number(terminal.quayLength) || 600);
  const weeks =
    period === 'week' ? 1 : period === 'month' ? 4 : period === 'quarter' ? 13 : 52;
  const motherDay = dailyFromBlocks(motherBlocks, (b, hours) => (b.toMeter - b.fromMeter) * hours);
  const bargeEach = (Number(bargeMeterHoursWeek) || 0) / 7;
  const locks = layoutLockZones(lockZones || [], quay, 1);
  const maintDay = dailyFromBlocks(locks, (z, hours) => {
    const cap = Math.max(0, Math.min(100, Number(z.capacityPct) ?? 0));
    return (z.toMeter - z.fromMeter) * hours * (1 - cap / 100);
  });

  const cells = [];
  for (let w = 0; w < weeks; w++) {
    const factor = period === 'week' ? 1 : 0.78 + 0.28 * (0.5 + 0.5 * Math.sin((w / 52) * Math.PI * 2 - 0.9));
    for (let d = 0; d < 7; d++) {
      const design = quay * 24;
      const available = Math.max(1, design - maintDay[d]);
      const demand = (motherDay[d] + bargeEach) * factor;
      const bor = demand / available;
      cells.push({
        week: w + 1,
        day: DAY_KEYS[d],
        bor,
        band: borBand(bor),
      });
    }
  }
  const hot = cells.filter((c) => c.band === 'hot').length;
  const warm = cells.filter((c) => c.band === 'warm').length;
  return { cells, hot, warm, cool: cells.length - hot - warm };
}

export function capacityErosion({ terminal, berth, metrics, weeks }) {
  const limits = thresholdsOf(metrics);
  const quay = Number(terminal.quayLength) || 0;
  const hours = Number(terminal.workingHoursPerDay) || 24;
  const daysPerWeek = Number(terminal.workingDaysPerWeek) || 7;
  const w = weeks || 1;
  const design = quay * hours * daysPerWeek * w;
  const maintenance = (berth.lockZonesLostMeterHoursWeek || 0) * w;
  const breakdown = design * (limits.unplannedBreakdownPct / 100);
  const net = Math.max(0, design - maintenance - breakdown);
  const used = (berth.proformaMeterHoursWeek || 0) * w;
  return {
    design,
    maintenance,
    breakdown,
    net,
    used,
    erosionPct: design > 0 ? (maintenance + breakdown) / design : 0,
    maintenancePct: design > 0 ? maintenance / design : 0,
    breakdownPct: limits.unplannedBreakdownPct / 100,
  };
}

function monthStamp(index, total = 36) {
  const end = new Date(2026, 8, 1);
  const d = new Date(end);
  d.setMonth(end.getMonth() - (total - 1 - index));
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${m}/${String(d.getFullYear()).slice(2)}`;
}

export function buildServiceTrends(services = []) {
  const groups = new Map();
  for (const row of services) {
    if (!row?.service) continue;
    const key = String(row.service).trim().toUpperCase();
    const stay =
      row.netPortstay != null
        ? Number(row.netPortstay)
        : netPortstayHours(row.etbDay, row.etbTime, row.etdDay, row.etdTime);
    const vol = Number(row.expectedVolume ?? row.volume) || 0;
    const cur = groups.get(key) || { service: row.service, volume: 0, staySum: 0, calls: 0 };
    cur.volume += vol;
    cur.staySum += stay;
    cur.calls += 1;
    groups.set(key, cur);
  }
  const lines = [...groups.values()].map((g) => {
    const weekly = g.volume;
    const stay = g.calls ? g.staySum / g.calls : 0;
    const drift = (unitMix(g.service) - 0.42) * 0.4;
    const points = Array.from({ length: 36 }, (_, i) => {
      const t = i / 35;
      const season = 1 + 0.06 * Math.sin((i / 12) * Math.PI * 2);
      const noise = 1 + (unitMix(`${g.service}-${i}`) - 0.5) * 0.04;
      const volIndex = (1 + drift * t) * season * noise;
      const stayIndex = (1 + drift * 0.55 * t) * (1 + (unitMix(`${g.service}-s${i}`) - 0.5) * 0.03);
      return {
        label: monthStamp(i),
        volume: weekly * (52 / 12) * volIndex,
        portstay: stay * stayIndex,
      };
    });
    const first = points[0];
    const last = points[points.length - 1];
    return {
      service: g.service,
      points,
      volumeDelta: first.volume > 0 ? (last.volume - first.volume) / first.volume : 0,
      portstayDelta: first.portstay > 0 ? (last.portstay - first.portstay) / first.portstay : 0,
    };
  });
  return lines.sort((a, b) => b.points[b.points.length - 1].volume - a.points[a.points.length - 1].volume);
}

export function buildSpeedTrend(metrics = {}, avgPmph = 0) {
  const endCmph = Number(metrics.vesselCmph) || 28;
  const endPmph = Number(avgPmph) || endCmph * 2.4;
  const points = Array.from({ length: 36 }, (_, i) => {
    const t = i / 35;
    const cmph = (endCmph / 0.92) * (1 - 0.08 * t) * (1 + (unitMix(`cmph-${i}`) - 0.5) * 0.015);
    const pmph = (endPmph / 0.92) * (1 - 0.08 * t) * (1 + (unitMix(`pmph-${i}`) - 0.5) * 0.02);
    return { label: monthStamp(i), cmph, pmph };
  });
  const first = points[0];
  const last = points[points.length - 1];
  return {
    points,
    cmphDelta: first.cmph > 0 ? (last.cmph - first.cmph) / first.cmph : 0,
    pmphDelta: first.pmph > 0 ? (last.pmph - first.pmph) / first.pmph : 0,
  };
}

export function buildPunctuality(services = []) {
  const codes = [...new Set((services || []).filter((s) => s?.service).map((s) => String(s.service)))];
  const quarters = Array.from({ length: 12 }, (_, i) => {
    const year = 2023 + Math.floor((9 + i) / 4);
    const q = ((9 + i) % 4) + 1;
    const lateRate = 0.09 + 0.1 * (0.5 + 0.5 * Math.sin(i / 2.2)) + (unitMix(`late-${i}`) - 0.5) * 0.03;
    const lateHours = 2.2 + lateRate * 8;
    return {
      label: `Q${q}'${String(year).slice(2)}`,
      lateRate: Math.max(0.04, Math.min(0.42, lateRate)),
      lateHours,
      bufferHrs: Math.max(0.5, Math.round(lateHours * lateRate * 10) / 10),
    };
  });
  const byService = codes.map((service) => {
    const lateRate = 0.08 + unitMix(`svc-late-${service}`) * 0.22;
    const lateHours = 1.5 + unitMix(`svc-hrs-${service}`) * 5;
    return {
      service,
      lateRate,
      lateHours,
      bufferHrs: Math.max(0.5, Math.round(lateHours * 2) / 2),
    };
  });
  const latest = quarters[quarters.length - 1];
  return { quarters, byService, recommendedBufferHrs: latest.bufferHrs };
}

function flexibleCall(services = []) {
  const rows = (services || []).filter((s) => s?.service);
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const va = Number(a.expectedVolume ?? a.volume) || 0;
    const vb = Number(b.expectedVolume ?? b.volume) || 0;
    if (va !== vb) return va - vb;
    return (Number(a.loa) || 0) - (Number(b.loa) || 0);
  })[0];
}

export function suggestExternalBerth({ berth, motherBlocks, services, externalBerths, metrics }) {
  const limits = thresholdsOf(metrics);
  const bor = berth?.berthUtilization || 0;
  const borPct = bor * 100;
  const geometricWait = (motherBlocks || [])
    .filter((b) => (b.weekIndex ?? 0) === 0 && b.overflow)
    .reduce((m, b) => Math.max(m, b.endHour - b.startHour), 0);

  const spillLine = berth.availableMeterHoursWeek * (limits.borSpillPct / 100);
  const excessMh = Math.max(0, (berth.proformaMeterHoursWeek || 0) - spillLine);
  const avgOcc =
    (berth.services || []).reduce((s, r) => s + (Number(r.occupation) || 0), 0) /
      Math.max(1, (berth.services || []).length) || 1;
  const exposureHours = excessMh / avgOcc;

  const alert = borPct >= limits.borAlertPct;
  const trigger = borPct >= limits.borSpillPct || geometricWait >= limits.waitingTriggerHrs;
  const call = flexibleCall(berth.services?.length ? berth.services : services);
  const loa = Number(call?.loa) || 0;
  const candidates = [...(externalBerths || [])].sort(
    (a, b) => (Number(a.hireVnd) || 0) - (Number(b.hireVnd) || 0)
  );
  const fit = candidates.find((b) => (Number(b.maxLoa) || 9999) >= loa && (Number(b.quayLength) || 0) >= loa);
  const pick = fit || candidates[0] || null;
  const hireVnd = Number(pick?.hireVnd) || 0;
  const penaltyVnd = exposureHours * limits.delayPenaltyVndPerHour;

  return {
    alert,
    trigger,
    bor,
    borPct,
    geometricWait,
    exposureHours,
    call,
    berth: pick,
    hireVnd,
    penaltyVnd,
    netVnd: penaltyVnd - hireVnd,
    thresholds: limits,
  };
}

export function buildOperations({
  services = [],
  terminal = {},
  metrics = {},
  lockZones = [],
  berth,
  externalBerths = [],
  period = 'week',
  avgPmph = 0,
}) {
  if (!berth) throw new Error('buildOperations requires a berth capacity snapshot');
  const quay = Math.max(50, Number(terminal.quayLength) || 600);
  const obstacles = weekLocalObstacles(lockZones, quay);
  const motherBlocks = layoutMotherVessels(berth.services, quay, 1, obstacles);
  const lockBlocks = layoutLockZones(lockZones || [], quay, 1);
  const minWidth = Math.min(
    quay,
    Number(berth.barge?.occupation) ||
      berthOccupation(Number(metrics.bargeLoa) || 75, metrics.mooringCap ?? 30, metrics.mooringRatio ?? 0.1)
  );
  const bargeWindows = planBargeWindows({
    blocks: motherBlocks,
    lockBlocks,
    quayLength: quay,
  });
  const bargeFit = bargeCapacityFromWindows(
    bargeWindows,
    berth.barge?.berthHours,
    berth.barge?.occupation || minWidth
  );
  const designWeek = quay * (Number(terminal.workingHoursPerDay) || 24) * (Number(terminal.workingDaysPerWeek) || 7);
  const maintenanceWeek = berth.lockZonesLostMeterHoursWeek || 0;
  const weeks = period === 'week' ? 1 : period === 'month' ? (Number(terminal.workingWeeksPerYear) || 52) / 12 : period === 'quarter' ? (Number(terminal.workingWeeksPerYear) || 52) / 4 : Number(terminal.workingWeeksPerYear) || 52;

  return {
    designWeek,
    maintenanceWeek,
    availableWeek: Math.max(0, designWeek - maintenanceWeek),
    motherBlocks,
    lockBlocks,
    bargeWindows,
    bargeFit,
    heatmap: buildBorHeatmap({
      motherBlocks,
      bargeMeterHoursWeek: berth.bargeMeterHours,
      lockZones,
      terminal,
      period,
    }),
    erosion: capacityErosion({ terminal, berth, metrics, weeks }),
    serviceTrends: buildServiceTrends(berth.services),
    speedTrend: buildSpeedTrend(metrics, avgPmph),
    punctuality: buildPunctuality(services),
    spill: suggestExternalBerth({ berth, motherBlocks, services, externalBerths, metrics }),
    exampleOccupation: berth.services[0]
      ? {
          service: berth.services[0].service,
          loa: berth.services[0].loa,
          mooring: berth.services[0].mooring1,
          occupation: berth.services[0].occupation,
          netPortstay: berth.services[0].netPortstay,
          cmph: berth.services[0].cmph,
          pmph: berth.services[0].pmph,
          craneDensity: berth.services[0].craneDensity,
        }
      : null,
  };
}
