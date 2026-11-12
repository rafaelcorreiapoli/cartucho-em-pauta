import { type BuildingKind, type Side } from '@brwars/simulation';
import { buildingArt } from '../building-art';

export function BuildingPortrait({
  kind,
  side,
  level = 1,
}: {
  kind: BuildingKind;
  side: Side;
  level?: number;
}) {
  const art = buildingArt(kind, side, level);
  return (
    <svg
      className="civic-asset"
      viewBox={`0 0 ${art.width} ${art.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <svg width={art.width} height={art.height} overflow="hidden">
        <image
          href={`/assets/${art.file}`}
          width={art.sheetWidth}
          height={art.sheetHeight}
          x={-(art.frame % art.columns) * art.width}
          y={-Math.floor(art.frame / art.columns) * art.height}
        />
      </svg>
    </svg>
  );
}
export function BasePortrait({ side }: { side: Side }) {
  const index = side === 'left' ? 3 : 7;
  return (
    <svg
      className="building-asset"
      viewBox="0 0 384 512"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <svg width={384} height={512} overflow="hidden">
        <image
          href="/assets/buildings.png"
          width={1536}
          height={1024}
          x={-(index % 4) * 384}
          y={-Math.floor(index / 4) * 512}
        />
      </svg>
    </svg>
  );
}
