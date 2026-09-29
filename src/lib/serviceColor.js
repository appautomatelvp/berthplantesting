/** Distinct, high-contrast palette for berth-plan services (user-overridable). */
export const SERVICE_COLOR_PALETTE = [
  '#0e7490',
  '#0369a1',
  '#1d4ed8',
  '#4338ca',
  '#0f766e',
  '#b45309',
  '#be123c',
  '#7c3aed',
  '#0891b2',
  '#c2410c',
  '#047857',
  '#a21caf',
  '#1e40af',
  '#b91c1c',
  '#0f766e',
  '#334155',
];

export function normalizeHex(color, fallback = '#0e7490') {
  if (!color || typeof color !== 'string') return fallback;
  const c = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    const r = c[1];
    const g = c[2];
    const b = c[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

/** Default color for a service line by stable index in unique service list. */
export function defaultColorForService(serviceCode, allServices = []) {
  const codes = [];
  for (const s of allServices) {
    const k = String(s?.service || '')
      .trim()
      .toUpperCase();
    if (k && !codes.includes(k)) codes.push(k);
  }
  const key = String(serviceCode || '')
    .trim()
    .toUpperCase();
  let idx = codes.indexOf(key);
  if (idx < 0) idx = Math.max(0, codes.length);
  return SERVICE_COLOR_PALETTE[idx % SERVICE_COLOR_PALETTE.length];
}

/**
 * Resolve display color for a row.
 * Prefer stored row.color; else map by service line; else palette index.
 */
export function resolveServiceColor(row, allServices = [], colorMap = null) {
  const map = colorMap || buildServiceColorMap(allServices);
  const key = String(row?.service || '')
    .trim()
    .toUpperCase();
  if (row?.color) return normalizeHex(row.color, map.get(key) || SERVICE_COLOR_PALETTE[0]);
  if (key && map.has(key)) return map.get(key);
  return defaultColorForService(row?.service, allServices);
}

/**
 * One color per service line code — first explicit color wins, else palette.
 * Guarantees consistency across BERTH PLAN, Capacity, Dashboard.
 */
export function buildServiceColorMap(services = []) {
  const map = new Map();
  const order = [];
  for (const s of services || []) {
    const key = String(s?.service || '')
      .trim()
      .toUpperCase();
    if (!key) continue;
    if (!order.includes(key)) order.push(key);
    if (s.color && !map.has(key)) {
      map.set(key, normalizeHex(s.color));
    }
  }
  order.forEach((key, i) => {
    if (!map.has(key)) {
      map.set(key, SERVICE_COLOR_PALETTE[i % SERVICE_COLOR_PALETTE.length]);
    }
  });
  return map;
}

/** Apply a color to every call of the same service line. */
export function applyColorToServiceLine(services, serviceCode, color) {
  const key = String(serviceCode || '')
    .trim()
    .toUpperCase();
  const hex = normalizeHex(color);
  return (services || []).map((s) =>
    String(s.service || '')
      .trim()
      .toUpperCase() === key
      ? { ...s, color: hex }
      : s
  );
}

/** Ensure every row has a color field (seed / add / migrate). */
export function withServiceColors(services = []) {
  const map = buildServiceColorMap(services);
  return (services || []).map((s) => {
    const key = String(s?.service || '')
      .trim()
      .toUpperCase();
    const color = s.color ? normalizeHex(s.color, map.get(key)) : map.get(key) || SERVICE_COLOR_PALETTE[0];
    return { ...s, color };
  });
}

export function contrastLabel(bg) {
  const hex = normalizeHex(bg, '#0e7490').slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0b1724' : '#f8fafc';
}
