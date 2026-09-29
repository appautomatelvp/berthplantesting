import { meterToLeftPercent, segmentCss, snap } from '../../../shared/utils/uiSettings.js';

export const CRANE_WIDTH_M = 30;

/** Resolve crane positions; keep stored positionM (start of 30m footprint) or auto-space. */
export function layoutCranes(cranes, quayLength) {
  const L = Math.max(CRANE_WIDTH_M, Number(quayLength) || 600);
  const sorted = [...(cranes || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const n = sorted.length;
  if (!n) return [];

  return sorted.map((c, i) => {
    let fromM;
    if (c.positionM != null && Number.isFinite(Number(c.positionM))) {
      fromM = Number(c.positionM);
    } else {
      const t = n === 1 ? 0.5 : i / (n - 1);
      fromM = Math.max(0, Math.min(L - CRANE_WIDTH_M, t * (L - CRANE_WIDTH_M)));
    }
    fromM = Math.max(0, Math.min(L - CRANE_WIDTH_M, fromM));
    return {
      ...c,
      fromM,
      toM: fromM + CRANE_WIDTH_M,
      widthM: CRANE_WIDTH_M,
      index: i,
    };
  });
}

export function craneSegmentCss(fromM, quayLength, direction) {
  return segmentCss(fromM, fromM + CRANE_WIDTH_M, quayLength, direction);
}

export function clampCranePosition(positionM, quayLength) {
  const L = Math.max(CRANE_WIDTH_M, Number(quayLength) || 600);
  return Math.max(0, Math.min(L - CRANE_WIDTH_M, snap(Number(positionM) || 0, 1)));
}

/**
 * Drag clamp: keep position on quay AND do not cross neighbors by configured order.
 * Never changes `order` â€” only limits how far a crane may slide.
 */
export function clampCraneDragPosition(craneId, positionM, cranes, quayLength) {
  const L = Math.max(CRANE_WIDTH_M, Number(quayLength) || 600);
  let pos = clampCranePosition(positionM, L);
  const sorted = [...(cranes || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const idx = sorted.findIndex((c) => c.id === craneId);
  if (idx < 0) return pos;

  const prev = sorted[idx - 1];
  const next = sorted[idx + 1];
  const minPos = prev
    ? clampCranePosition((Number(prev.positionM) || 0) + CRANE_WIDTH_M, L)
    : 0;
  const maxPos = next
    ? clampCranePosition((Number(next.positionM) || 0) - CRANE_WIDTH_M, L)
    : L - CRANE_WIDTH_M;

  if (minPos <= maxPos) {
    pos = Math.max(minPos, Math.min(maxPos, pos));
  }
  return pos;
}

export function clientXToCraneStart(clientX, plotRect, quayLength, direction) {
  const L = Math.max(CRANE_WIDTH_M, Number(quayLength) || 600);
  const ratio = Math.min(1, Math.max(0, (clientX - plotRect.left) / plotRect.width));
  const meter =
    direction === 'ltr' ? ratio * L : (1 - ratio) * L;
  // center of crane under cursor â†’ start = center - width/2
  return clampCranePosition(meter - CRANE_WIDTH_M / 2, L);
}

/** Meter delta from horizontal pointer movement on the rail. */
export function clientDeltaToMeters(deltaX, plotWidth, quayLength, direction) {
  const L = Math.max(CRANE_WIDTH_M, Number(quayLength) || 600);
  const w = Math.max(1, plotWidth);
  const deltaM = (deltaX / w) * L;
  return direction === 'ltr' ? deltaM : -deltaM;
}

export { meterToLeftPercent };
