import React, { useEffect, useState } from 'react';

const MIN = 50;
const MAX = 5000;

/** Cho gõ tự do; chỉ clamp khi blur / Enter — tránh lỗi không gõ được vì Math.max(50) trên từng ký tự. */
export default function QuayLengthInput({
  value,
  onCommit,
  className = 'quay-inline',
  min = MIN,
  max = MAX,
}) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value ?? ''));
  }, [value, focused]);

  const commit = () => {
    const n = Number(String(draft).replace(/[^\d.]/g, ''));
    const next = Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, Math.round(n))) : min;
    setDraft(String(next));
    if (next !== value) onCommit(next);
    else setDraft(String(value ?? next));
  };

  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      value={draft}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
        e.stopPropagation();
      }}
    />
  );
}
