import React from 'react';

/** Floating tooltip for charts. Position is viewport coordinates. */
export default function ChartTip({ hover }) {
  if (!hover) return null;
  const width = 250;
  const left = Math.max(8, Math.min(hover.x + 14, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(hover.y + 16, window.innerHeight - 28 - hover.rows.length * 22));
  return (
    <div className="chart-tip" style={{ left, top }} role="tooltip">
      <strong>{hover.title}</strong>
      {hover.rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="chart-tip-row">
          <i style={{ background: row.color || '#94a3b8' }} />
          <span>{row.label}</span>
          <b>{row.value}</b>
        </div>
      ))}
    </div>
  );
}
