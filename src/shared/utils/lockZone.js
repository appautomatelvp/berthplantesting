import { dayIndex, toDayFraction } from '../../features/capacity/utils/engine.js';

/**
 * Lock zone = quay segment Ã— time window with reduced operating capacity.
 * capacityPct = remaining usable capacity of the zone (0â€“100).
 */

export function clampLockZone(zone, quayLength) {
  const L = Math.max(50, Number(quayLength) || 600);
  const lengthM = Math.max(1, Math.min(L, Number(zone.lengthM) || 30));
  let fromMeter = Number(zone.fromMeter) || 0;
  fromMeter = Math.max(0, Math.min(L - lengthM, fromMeter));
  const capacityPct = Math.max(0, Math.min(100, Number(zone.capacityPct) ?? 0));
  return {
    ...zone,
    fromMeter,
    lengthM,
    toMeter: fromMeter + lengthM,
    capacityPct,
    reason: zone.reason || '',
  };
}

/** Place lock zones on the multi-week plan (same time model as services). */
export function layoutLockZones(zones, quayLength, weeks = 1) {
  const L = Math.max(50, Number(quayLength) || 600);
  const placed = [];
  for (let w = 0; w < weeks; w++) {
    const offset = w * 168;
    for (const raw of zones || []) {
      const z = clampLockZone(raw, L);
      let start = (dayIndex(z.etbDay) + toDayFraction(z.etbTime)) * 24 + offset;
      let end = (dayIndex(z.etdDay) + toDayFraction(z.etdTime)) * 24 + offset;
      if (end <= start) end += 168;
      placed.push({
        ...z,
        weekIndex: w,
        key: `${z.id}-w${w}`,
        startHour: start,
        endHour: end,
        fromMeter: z.fromMeter,
        toMeter: z.toMeter,
      });
    }
  }
  return placed;
}
