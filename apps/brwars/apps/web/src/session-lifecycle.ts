import type { Session } from './session';
/** BFCache freezes the page and its timers; closing here would kill the restored match. */
export function bindSessionPageLifecycle(target: EventTarget, session: Pick<Session, 'close'>) {
  const onPageHide = (event: Event) => {
    if (!(event as PageTransitionEvent).persisted) session.close();
  };
  target.addEventListener('pagehide', onPageHide);
  return () => target.removeEventListener('pagehide', onPageHide);
}
