import { type Side } from './content';
import campo from './maps/campo.json';
import paulista from './maps/paulista.json';
import reserva from './maps/reserva.json';

export const BATTLEFIELDS = {
  campo: 'Campo original',
  paulista: 'Avenida Paulista',
  floresta: 'Reserva indígena',
  deserto: 'Deserto',
  reserva: 'Reserva indígena (legada)',
} as const;

export type BattlefieldKind = keyof typeof BATTLEFIELDS;

export function battlefieldKind(value: unknown): BattlefieldKind {
  return typeof value === 'string' && Object.hasOwn(BATTLEFIELDS, value)
    ? (value as BattlefieldKind)
    : 'campo';
}

type MapPoint = { x: number; y: number };
type MapObject = MapPoint & {
  name: string;
  width: number;
  height: number;
  polyline?: MapPoint[];
  properties?: { name: string; value: boolean }[];
};

function readLayout(map: typeof campo) {
  const objects = (name: string) =>
    map.layers.find((layer) => layer.name === name)!.objects! as MapObject[];
  const start = objects('route')[0];
  const [first, last] = start?.polyline ?? [];
  if (start?.polyline?.length !== 2 || first.x >= last.x)
    throw new Error('A rota precisa ter dois pontos em ordem da esquerda para a direita.');
  const terrain = map.layers.find((layer) => layer.name === 'terrain')!.data!;
  const route = {
    from: start.x + first.x,
    to: start.x + last.x,
    y: start.y + first.y,
    endY: start.y + last.y,
  };
  const yAt = (x: number) =>
    route.y + ((x - route.from) / (route.to - route.from)) * (route.endY - route.y);
  const firstColumn = Math.floor(route.from / map.tilewidth);
  const lastColumn = Math.floor(route.to / map.tilewidth);
  for (let col = firstColumn; col <= lastColumn; col++) {
    const leftY = yAt(Math.max(route.from, col * map.tilewidth));
    const rightY = yAt(Math.min(route.to, (col + 1) * map.tilewidth));
    const firstRow = Math.floor(Math.min(leftY, rightY) / map.tileheight);
    const lastRow = Math.floor((Math.max(leftY, rightY) + 4 * LANE_ROW_SPACING) / map.tileheight);
    for (let row = firstRow; row <= lastRow; row++) {
      if (terrain[row * map.width + col] !== 2)
        throw new Error('A rota precisa atravessar células de passagem.');
    }
  }
  const plotsFor = (side: Side) => {
    const slots = new Set<number>();
    return objects(`plots-${side}`).map(({ name, x, y, properties }) => {
      const slot = Number(name);
      if (!Number.isSafeInteger(slot) || slot < 0 || slots.has(slot))
        throw new Error('O lote precisa ter um número de posição válido e único.');
      slots.add(slot);
      const index = Math.floor(y / map.tileheight) * map.width + Math.floor(x / map.tilewidth);
      if (terrain[index] !== 1)
        throw new Error('O lote precisa estar em uma célula de construção.');
      return {
        slot,
        x,
        y,
        owned: properties?.some(({ name, value }) => name === 'owned' && value) ?? false,
      };
    });
  };
  const bases = objects('bases');
  return {
    bases: {
      left: bases.find(({ name }) => name === 'left')!,
      right: bases.find(({ name }) => name === 'right')!,
    },
    plots: { left: plotsFor('left'), right: plotsFor('right') },
    decorations: objects('decorations'),
    road: objects('road')[0],
    route,
  };
}

export const MAP_WIDTH = campo.width * campo.tilewidth;
export const MAP_HEIGHT = campo.height * campo.tileheight;

export const LANE_ROW_SPACING = 12;

const paulistaLayout = readLayout(paulista);
const layouts = {
  campo: readLayout(campo),
  paulista: paulistaLayout,
  floresta: paulistaLayout,
  deserto: paulistaLayout,
  reserva: readLayout(reserva),
};

export function battlefieldLayout(kind: BattlefieldKind = 'campo') {
  return layouts[kind];
}

export function usesPaulistaLayout(kind?: BattlefieldKind) {
  return battlefieldLayout(kind) === paulistaLayout;
}
