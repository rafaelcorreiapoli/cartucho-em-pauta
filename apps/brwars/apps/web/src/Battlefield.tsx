import { buildingUpgradeCost } from '@brwars/simulation';
import { useEffect, useRef, useState } from 'react';
import { MapBuildingOverlays } from './battle/MapBuildingOverlays';
import type { BattlefieldProps, BattlefieldState } from './battle/contracts';
import { mountBattlefield } from './battle/mount';
import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, clampZoom } from './camera';

export function Battlefield({
  session,
  onLoadingChange,
  selection,
  onSelect,
  onUpgrade,
  cameraTarget,
  onCameraChange,
}: BattlefieldProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const host = useRef<HTMLDivElement>(null);
  const overlayWorld = useRef<HTMLDivElement>(null);
  const upgradeFeedback = useRef<BattlefieldState['upgradeFeedback']>(new Map());
  const current = useRef({
    session,
    selection,
    onSelect,
    cameraTarget,
    onCameraChange,
    zoom,
    upgradeFeedback: upgradeFeedback.current,
  });
  current.current = {
    session,
    selection,
    onSelect,
    cameraTarget,
    onCameraChange,
    zoom,
    upgradeFeedback: upgradeFeedback.current,
  };
  useEffect(() => {
    if (!host.current || !overlayWorld.current) return;
    return mountBattlefield({
      host: host.current,
      overlay: overlayWorld.current,
      readState: () => current.current,
      onZoom: setZoom,
      onLoadingChange,
    });
  }, [session.side, session.battlefield, onLoadingChange]);
  const game = session.getState();
  return (
    <div className="battlefield-layer">
      <div
        className="battlefield"
        ref={host}
        role="img"
        aria-label="Campo de batalha. Selecione os terrenos e melhore construções diretamente no mapa."
      />
      <div className="camera-controls" data-camera-controls>
        <button
          aria-label="Afastar câmera"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom((value) => clampZoom(value - 0.1))}
        >
          −
        </button>
        <input
          aria-label="Zoom da câmera"
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
        />
        <button
          aria-label="Aproximar câmera"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom((value) => clampZoom(value + 0.1))}
        >
          +
        </button>
        <button
          className="zoom-reset"
          aria-label="Restaurar zoom inicial"
          onClick={() => setZoom(DEFAULT_ZOOM)}
        >
          {Math.round(zoom * 100)}%
        </button>
      </div>
      <MapBuildingOverlays
        game={game}
        playerSide={session.side}
        nicknames={
          session.mode === 'local'
            ? {
                left: session.side === 'left' ? 'Você' : 'IA',
                right: session.side === 'right' ? 'Você' : 'IA',
              }
            : session.nicknames
        }
        selection={selection}
        onSelect={onSelect}
        onUpgrade={(slot, origin) => {
          const building = session
            .getState()
            .players[session.side].buildings.find((item) => item.slot === slot);
          if (building && origin)
            upgradeFeedback.current.set(slot, {
              session,
              level: building.level,
              cost: buildingUpgradeCost(building),
              ...origin,
              createdAt: performance.now(),
            });
          onUpgrade(slot);
        }}
        worldRef={overlayWorld}
      />
    </div>
  );
}
