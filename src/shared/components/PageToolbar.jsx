import { Children, cloneElement, isValidElement, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Renders this tab's function buttons into the bar under the main navigation. */
export default function PageToolbar({ children }) {
  const [host, setHost] = useState(null);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    setHost(document.getElementById('page-fnbar'));
  }, []);

  if (!host) return null;

  const items = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;
    const prev = child.props.className || '';
    return cloneElement(child, {
      className: `${prev} ${picked === index ? 'fn-picked' : ''}`.replace(/\s+/g, ' ').trim(),
      onClick: (event) => {
        setPicked(index);
        child.props.onClick?.(event);
      },
    });
  });

  return createPortal(<div className="page-fnbar-actions">{items}</div>, host);
}
