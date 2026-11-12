import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DetailTooltip, readDetailTip, type DetailTip } from './DetailTooltip';
import { ResearchTooltip, readResearchTip, type ResearchTip } from './ResearchTooltip';
/** One tooltip layer for all HUD icons, including those unavailable during cooldown. */
export function HudTooltip() {
  const [tip, setTip] = useState<{
      text: string;
      research?: ResearchTip;
      detail?: DetailTip;
      x: number;
      y: number;
    } | null>(null),
    element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let anchor: HTMLElement | null = null;
    const find = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>('[data-hud-tooltip]') : null;
    const content = (target: HTMLElement) => ({
      text: target.dataset.hudTooltip ?? '',
      research: readResearchTip(target),
      detail: readDetailTip(target),
    });
    const observer = new MutationObserver(() => {
      if (anchor) {
        const next = content(anchor);
        setTip((previous) => (previous ? { ...previous, ...next } : previous));
      }
    });
    const show = (target: HTMLElement, x: number, y: number) => {
      observer.disconnect();
      anchor = target;
      observer.observe(target, {
        attributes: true,
        attributeFilter: [
          'data-hud-detail',
          'data-hud-tooltip',
          'data-hud-research-title',
          'data-hud-research-category',
          'data-hud-research-level',
          'data-hud-research-current',
          'data-hud-research-next',
          'data-hud-research-cost',
          'data-hud-research-seconds',
          'data-hud-research-status',
        ],
      });
      setTip({ ...content(target), x, y });
    };
    const over = (event: PointerEvent) => {
      const target = find(event.target);
      if (target) show(target, event.clientX, event.clientY);
    };
    const move = (event: PointerEvent) => {
      if (anchor) setTip({ ...content(anchor), x: event.clientX, y: event.clientY });
    };
    const out = (event: PointerEvent) => {
      if (anchor && !anchor.contains(event.relatedTarget as Node | null)) {
        observer.disconnect();
        anchor = null;
        setTip(null);
      }
    };
    const focus = (event: FocusEvent) => {
      const target = find(event.target);
      if (target) {
        const rect = target.getBoundingClientRect();
        show(target, rect.left + rect.width / 2, rect.bottom);
      }
    };
    const hide = () => {
      observer.disconnect();
      anchor = null;
      setTip(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('pointerover', over);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerout', out);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', key);
    window.addEventListener('blur', hide);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', key);
      window.removeEventListener('blur', hide);
    };
  }, []);
  useLayoutEffect(() => {
    if (!tip || !element.current) return;
    const node = element.current,
      { width, height } = node.getBoundingClientRect();
    node.style.left = `${Math.max(10, Math.min(tip.x + 14, window.innerWidth - width - 10))}px`;
    node.style.top = `${Math.max(10, tip.y + height + 28 > window.innerHeight ? tip.y - height - 12 : tip.y + 18)}px`;
  }, [tip]);
  return tip?.text
    ? createPortal(
        <div ref={element} className="hud-tooltip" role="tooltip">
          {tip.detail ? (
            <DetailTooltip tip={tip.detail} />
          ) : tip.research ? (
            <ResearchTooltip tip={tip.research} />
          ) : (
            tip.text
          )}
        </div>,
        document.body,
      )
    : null;
}
