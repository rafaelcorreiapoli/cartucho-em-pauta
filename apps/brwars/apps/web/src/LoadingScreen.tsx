import { useEffect, useRef } from 'react';
import { Sword } from '@phosphor-icons/react';
import type { LoadingState } from './loading-assets';
import './loading.css';
export function LoadingScreen({
  state,
  onStart,
  starting,
}: {
  state: LoadingState;
  onStart: () => void;
  starting: boolean;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.ready) button.current?.focus({ preventScroll: true });
  }, [state.ready]);
  const percent = Math.floor(state.progress * 100);
  return (
    <div
      className="game-loading hud-loading"
      role="dialog"
      aria-modal="true"
      aria-label="Preparando Base Aliada"
      data-game-loading
    >
      <div className="loading-emblem">
        <Sword weight="duotone" />
      </div>
      <h1 className="hud-loading-title">
        BASE <span>ALIADA</span>
      </h1>
      <div className="hud-loading-content">
        <p role={state.error ? 'alert' : 'status'}>
          {state.error
            ? 'Não foi possível carregar a batalha'
            : starting
              ? 'Preparando o som…'
              : state.ready
                ? 'Tudo pronto para a batalha'
                : state.phase}
        </p>
        <progress
          className="hud-progress"
          aria-label="Carregamento dos recursos"
          max={100}
          value={percent}
        />
        <b className="hud-progress-value" aria-hidden="true">
          {percent}%
        </b>
        {state.error ? (
          <>
            <small>Verifique a conexão e tente novamente.</small>
            <button className="hud-button" type="button" onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          </>
        ) : (
          <button
            className="hud-button"
            ref={button}
            type="button"
            disabled={!state.ready || starting}
            onClick={onStart}
          >
            {state.ready ? 'Entrar na batalha' : 'Carregando…'}
          </button>
        )}
      </div>
    </div>
  );
}
