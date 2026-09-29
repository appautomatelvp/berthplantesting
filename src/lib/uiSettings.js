/** Time-scale presets for the berthing window vertical axis. */
export const TIME_SCALES = {
  hour: {
    id: 'hour',
    weeks: 1,
    pxPerHour: 32,
    tickEveryHours: 1,
    majorEveryHours: 6,
    pageHours: null,
    pages: 1,
  },
  day: {
    id: 'day',
    weeks: 4,
    pxPerHour: 10,
    tickEveryHours: 2,
    majorEveryHours: 6,
    /** One scroll page is one day. */
    pageHours: 24,
    pages: 28,
  },
  week: {
    id: 'week',
    weeks: 8,
    pxPerHour: 14,
    tickEveryHours: 6,
    majorEveryHours: 24,
    pageHours: 168,
    pages: 8,
  },
  month: {
    id: 'month',
    weeks: 24,
    pxPerHour: 6,
    tickEveryHours: 24,
    majorEveryHours: 168,
    /** Four proforma weeks fill one month page. */
    pageHours: 168 * 4,
    pages: 6,
  },
};

export const DEFAULT_UI = {
  timeScale: 'week',
  horizon: 'week',
  /** Quay meter axis: ltr = 0→L left-to-right; rtl = L→0 left-to-right (0 on the right). */
  meterDirection: 'rtl',
  /** Fields shown inside service blocks on the plan (order = display order). */
  blockFields: ['service', 'vessel', 'schedule', 'loa', 'occupation', 'meterHours', 'expectedVolume'],
  /** Daily shift handover marks on the BERTH PLAN time column. Empty hides that mark. */
  shiftHandoverA: '07:30',
  shiftHandoverB: '19:30',
  /** Red shift-handover marks on the BERTH PLAN time axis. */
  showShiftMarks: true,
};

/** One display choice for the whole system. Quarter and year use the month page on BERTH PLAN. */
export const HORIZONS = ['hour', 'day', 'week', 'month', 'quarter', 'year'];

export function berthScaleOf(horizon) {
  if (horizon === 'quarter' || horizon === 'year') return 'month';
  return TIME_SCALES[horizon] ? horizon : 'week';
}

/** Dashboard, guide, and spill math use week as the finest grain. */
export function reportPeriodOf(horizon) {
  if (horizon === 'month' || horizon === 'quarter' || horizon === 'year') return horizon;
  return 'week';
}

export function withHorizon(ui, horizon) {
  const next = HORIZONS.includes(horizon) ? horizon : 'week';
  return { ...(ui || {}), horizon: next, timeScale: berthScaleOf(next) };
}

/** All customizable labels inside a service block. */
export const BLOCK_FIELD_OPTIONS = [
  'service',
  'vessel',
  'schedule',
  'loa',
  'occupation',
  'berthRange',
  'volume',
  'expectedVolume',
  'meterHours',
  'netPortstay',
  'pmph',
  'cmph',
  'craneDensity',
];

export const QUAY_PRESETS = [300, 400, 500, 600, 700, 800, 1000];

export const METER_DIRECTIONS = ['ltr', 'rtl'];

/** Nice meter marks covering 0 … quayLength. */
export function buildMeterMarks(quayLength) {
  const L = Math.max(1, Number(quayLength) || 600);
  let step = 100;
  if (L <= 250) step = 50;
  else if (L <= 600) step = 100;
  else if (L <= 1200) step = 200;
  else step = 250;

  const marks = new Set([0, L]);
  for (let m = step; m < L; m += step) marks.add(Math.round(m * 10) / 10);
  return [...marks].sort((a, b) => a - b);
}

/** Map a meter position on the quay to CSS left% for the chart axis. */
export function meterToLeftPercent(meter, quayLength, direction = 'rtl') {
  const L = Math.max(1, Number(quayLength) || 1);
  const m = Number(meter) || 0;
  if (direction === 'ltr') return (m / L) * 100;
  return ((L - m) / L) * 100;
}

/** CSS left/width for a quay segment [fromMeter, toMeter]. */
export function segmentCss(fromMeter, toMeter, quayLength, direction = 'rtl') {
  const L = Math.max(1, Number(quayLength) || 1);
  const a = Math.min(fromMeter, toMeter);
  const b = Math.max(fromMeter, toMeter);
  const widthPct = ((b - a) / L) * 100;
  if (direction === 'ltr') {
    return { left: `${(a / L) * 100}%`, width: `${widthPct}%` };
  }
  return { left: `${((L - b) / L) * 100}%`, width: `${widthPct}%` };
}

export const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Valid HH:mm values used as daily shift-handover marks. */
export function editorShifts(ui) {
  if (Array.isArray(ui?.shifts) && ui.shifts.length) {
    return ui.shifts.map((row, index) => ({
      id: row?.id || `shift${index + 1}`,
      name: row?.name ?? '',
      start: row?.start ?? '07:30',
      end: row?.end ?? '19:30',
    }));
  }
  return shiftsOf(ui);
}

export function shiftsOf(ui) {
  const raw = Array.isArray(ui?.shifts) ? ui.shifts : [];
  const parsed = raw
    .map((row, index) => ({
      id: row?.id || `shift${index + 1}`,
      name: String(row?.name || '').trim() || `Ca ${index + 1}`,
      start: String(row?.start || ''),
      end: String(row?.end || ''),
    }))
    .filter((row) => /^([01]\d|2[0-3]):[0-5]\d$/.test(row.start) && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.end));
  if (parsed.length) return parsed;
  const start = ui?.shiftHandoverA || '07:30';
  const end = ui?.shiftHandoverB || '19:30';
  return [
    { id: 'shift1', name: 'Ca 1', start, end },
    { id: 'shift2', name: 'Ca 2', start: end, end: start },
  ];
}

export function handoverTimes(ui) {
  return [...new Set(shiftsOf(ui).map((row) => row.start))];
}

/** Absolute week-hours (0 … weeks×168) for each handover clock time. */
export function handoverWeekHours(times, weeks = 1) {
  const marks = [];
  const span = Math.max(1, weeks);
  for (let week = 0; week < span; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      times.forEach((clock) => {
        const [hh, mm] = clock.split(':').map(Number);
        marks.push({
          key: `${week}-${day}-${clock}`,
          hour: week * 168 + day * 24 + hh + mm / 60,
          label: clock,
        });
      });
    }
  }
  return marks;
}

export function pad2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

export function snap(value, step) {
  return Math.round(value / step) * step;
}

/** Absolute week-hour (0..168) → { day, time } */
export function hourToDayTime(hourInWeek, timeStepMin = 15) {
  let h = ((hourInWeek % 168) + 168) % 168;
  const day = Math.floor(h / 24);
  let hourFrac = h % 24;
  const totalMin = snap(hourFrac * 60, timeStepMin);
  let hh = Math.floor(totalMin / 60) % 24;
  let mm = totalMin % 60;
  // if snapped to 24:00 → next day 00:00 handled by caller for end times
  return { day: DAY_KEYS[day], time: `${pad2(hh)}:${pad2(mm)}`, hourValue: day * 24 + hh + mm / 60 };
}

/** Invert occupation → LOA given mooring rules. */
export function loaFromOccupation(occupation, mooringCap = 30, mooringRatio = 0.1) {
  const occ = Math.max(1, Number(occupation) || 1);
  const r = mooringRatio;
  const cap = mooringCap;
  const byRatio = occ / (1 + 2 * r);
  if (byRatio * r <= cap + 1e-9) return Math.max(1, Math.round(byRatio * 10) / 10);
  return Math.max(1, Math.round((occ - 2 * cap) * 10) / 10);
}

/** Client X within plot → meter on quay. */
export function clientXToMeter(clientX, plotRect, quayLength, direction) {
  const L = Math.max(1, quayLength);
  const ratio = Math.min(1, Math.max(0, (clientX - plotRect.left) / plotRect.width));
  if (direction === 'ltr') return ratio * L;
  return (1 - ratio) * L;
}

export function clientYToHour(clientY, plotRect, pxPerHour, totalHours) {
  const y = clientY - plotRect.top;
  return Math.min(totalHours, Math.max(0, y / pxPerHour));
}
