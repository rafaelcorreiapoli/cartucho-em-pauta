import { afterEach, expect, it, vi } from 'vitest';
import { bindSessionPageLifecycle } from './session-lifecycle';
import { localSession } from './session';
afterEach(() => vi.useRealTimers());
it('preserva o runtime da partida ao sair e voltar pelo BFCache', () => {
  vi.useFakeTimers();
  const target = new EventTarget(),
    session = localSession('left');
  const unsubscribe = session.subscribe(() => {}),
    unbind = bindSessionPageLifecycle(target, session);
  vi.advanceTimersByTime(100);
  const before = session.getState().time;
  target.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }));
  target.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
  vi.advanceTimersByTime(100);
  expect(session.getState().time).toBeGreaterThan(before);
  unbind();
  unsubscribe();
  session.close();
});
it('encerra a sessão em saída definitiva e remove seu listener ao trocar de sessão', () => {
  const target = new EventTarget(),
    close = vi.fn(),
    unbind = bindSessionPageLifecycle(target, { close });
  target.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: false }));
  expect(close).toHaveBeenCalledTimes(1);
  unbind();
  target.dispatchEvent(new Event('pagehide'));
  expect(close).toHaveBeenCalledTimes(1);
});
