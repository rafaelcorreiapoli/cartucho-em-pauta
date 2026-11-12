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
      className="game-loading"
      role="dialog"
      aria-modal="true"
      aria-label="Preparando Base Aliada"
      data-game-loading
    >
      <div className="loading-emblem">
        <Sword weight="duotone" />
      </div>
      <h1>
        BASE <span>ALIADA</span>
      </h1>
      <div className="loading-plaque">
        <p role={state.error ? 'alert' : 'status'}>
          {state.error
            ? 'Não foi possível carregar a batalha'
            : starting
              ? 'Preparando o som…'
              : state.ready
                ? 'Tudo pronto para a batalha'
                : state.phase}
        </p>
        <div
          className="loading-progress"
          role="progressbar"
          aria-label="Carregamento dos recursos"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
        <b className="loading-percent">{percent}%</b>
        {state.error ? (
          <>
            <small>Verifique a conexão e tente novamente.</small>
            <button type="button" onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          </>
        ) : (
          <button ref={button} type="button" disabled={!state.ready || starting} onClick={onStart}>
            {state.ready ? 'Entrar na batalha' : 'Carregando…'}
          </button>
        )}
      </div>
    </div>
  );
}
