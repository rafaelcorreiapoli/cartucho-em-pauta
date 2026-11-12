import {
  FACTIONS,
  HEROES,
  heroIdentity,
  troopName,
  type GameState,
  type Side,
} from '@brwars/simulation';
import { resolveSelection, type MapSelection } from '../selection';

export function selectionContext(game: GameState, side: Side, selection: MapSelection) {
  const entity = resolveSelection(game, selection);
  const selectedSide = entity.kind === 'empty' ? side : entity.side;
  const faction = FACTIONS[selectedSide];
  const owned = entity.kind !== 'empty' && entity.side === side;
  const own = game.players[side];
  const playing = game.status === 'playing';
  const title =
    entity.kind === 'empty'
      ? 'Selecione no mapa'
      : entity.kind === 'hero'
        ? HEROES[entity.record.hero].name
        : entity.kind === 'worker'
          ? faction.worker
          : entity.kind === 'unit'
            ? entity.unit.kind === 'hero'
              ? HEROES[heroIdentity(entity.unit)].name
              : troopName(selectedSide, entity.unit.kind, entity.unit.productionTier)
            : entity.kind === 'base'
              ? `Base da ${faction.name.toLowerCase()}`
              : entity.building
                ? faction.buildings[entity.building.kind]
                : 'Terreno de construção';

  return { entity, selectedSide, faction, owned, own, playing, title };
}
export type SelectionContext = ReturnType<typeof selectionContext>;
