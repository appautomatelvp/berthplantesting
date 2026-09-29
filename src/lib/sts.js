import { meterToLeftPercent } from '../lib/uiSettings';

/** Sorted STS list with computed meter position along quay (even spacing by order). */
export function layoutStsCranes(cranes, quayLength) {
  const L = Math.max(1, Number(quayLength) || 600);
  const sorted = [...(cranes || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const n = sorted.length;
  if (!n) return [];

  // Place centers evenly between 5% and 95% of quay length (physical meters)
  return sorted.map((c, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const positionM = 0.05 * L + t * 0.9 * L;
    return { ...c, positionM, index: i };
  });
}

export function stsCssLeft(positionM, quayLength, direction) {
  return `${meterToLeftPercent(positionM, quayLength, direction)}%`;
}
