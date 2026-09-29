import { useEffect, useState } from 'react';

/** Shows the data-tip of the button or link under the pointer. */
export default function ButtonHints() {
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const place = (event) => {
      const el = event.target?.closest?.('[data-tip]');
      const text = el?.getAttribute('data-tip')?.trim();
      if (!el || !text) {
        setTip(null);
        return;
      }
      const box = el.getBoundingClientRect();
      setTip({
        text,
        x: box.left + box.width / 2,
        y: box.bottom + 8,
      });
    };
    const clear = (event) => {
      const from = event.target?.closest?.('[data-tip]');
      const to = event.relatedTarget?.closest?.('[data-tip]');
      if (from && from !== to) setTip(null);
    };
    const hide = () => setTip(null);
    document.addEventListener('mouseover', place);
    document.addEventListener('mouseout', clear);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mouseover', place);
      document.removeEventListener('mouseout', clear);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  if (!tip) return null;
  const left = Math.max(120, Math.min(tip.x, window.innerWidth - 120));
  return (
    <div className="btn-tip" style={{ left, top: tip.y }} role="tooltip">
      {tip.text}
    </div>
  );
}
