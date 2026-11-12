import { useEffect, useRef, type ReactNode, type UIEvent } from 'react';

/** Keeps native scrolling; paints a transient thumb outside the scroll layout. */
export function ActionPanel({
  className,
  label,
  children,
}: {
  className: string;
  label: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null),
    thumb = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function showScroll(event: UIEvent<HTMLElement>) {
    const scroller = event.target as HTMLElement,
      indicator = thumb.current,
      root = panel.current;
    if (!indicator || !root || scroller.scrollWidth <= scroller.clientWidth) return;
    const rect = scroller.getBoundingClientRect(),
      parent = root.getBoundingClientRect();
    const width = Math.min(
      scroller.clientWidth,
      Math.max(24, scroller.clientWidth ** 2 / scroller.scrollWidth),
    );
    const left =
      rect.left -
      parent.left +
      ((scroller.clientWidth - width) * scroller.scrollLeft) /
        (scroller.scrollWidth - scroller.clientWidth);
    Object.assign(indicator.style, {
      width: `${width}px`,
      left: `${left}px`,
      top: `${rect.bottom - parent.top - 5}px`,
      opacity: '1',
    });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (thumb.current) thumb.current.style.opacity = '0';
    }, 700);
  }
  return (
    <section ref={panel} className={className} aria-label={label} onScrollCapture={showScroll}>
      {children}
      <div ref={thumb} className="action-scroll-indicator" aria-hidden="true" />
    </section>
  );
}
