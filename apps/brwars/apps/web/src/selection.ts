import { assignHotkeys } from './command-hotkeys';
import { HEROES, heroRoster, DEFAULT_HERO } from '@brwars/simulation';
import type {
  Building,
  Command,
  GameState,
  HeroKind,
  HeroRecord,
  Player,
  Side,
  Unit,
} from '@brwars/simulation';
import {
  BUILDINGS,
  battlefieldLayout,
  canUpgradeBuilding,
  BUILDING_HOTKEYS,
  isBuildingReady,
  missingBuildingRequirements,
  ownsPlot,
} from '@brwars/simulation';

export type MapSelection =
  | { kind: 'plot'; side: Side; slot: number }
  | { kind: 'hero'; side: Side; hero: HeroKind }
  | { kind: 'unit'; id: number }
  | { kind: 'worker'; side: Side; index: number }
  | { kind: 'base'; side: Side }
  | null;

export function nextFreePlot(
  game: GameState,
  side: Side,
  selection: MapSelection,
  reverse = false,
) {
  const current =
    selection?.kind === 'plot' && selection.side === side ? selection.slot : undefined;
  const occupied = new Set(game.players[side].buildings.map(({ slot }) => slot));
  const free = battlefieldLayout(game.battlefield).plots[side].filter(
    ({ slot }) => !occupied.has(slot),
  );
  if (reverse) free.reverse();
  return (
    free.find(({ slot }) => current === undefined || (reverse ? slot < current : slot > current)) ??
    free[0]
  );
}

export type ControlGroupMember = Exclude<MapSelection, null | { kind: 'hero' }>;

export function controlGroupMembers(
  game: GameState,
  side: Side,
  selections: readonly MapSelection[],
): ControlGroupMember[] {
  return selections.flatMap<ControlGroupMember>((selection) => {
    const entity = resolveSelection(game, selection);
    if (entity.kind === 'empty' || entity.side !== side) return [];
    if (entity.kind === 'worker') return [entity];
    if (entity.kind === 'base' && entity.player.baseHp > 0) return [{ kind: 'base', side }];
    if (entity.kind === 'plot' && entity.building)
      return [{ kind: 'plot', side, slot: entity.slot }];
    if (entity.kind === 'unit' && entity.unit.hp > 0) return [{ kind: 'unit', id: entity.unit.id }];
    return [];
  });
}

export type SelectedEntity =
  | { kind: 'hero'; side: Side; record: HeroRecord }
  | { kind: 'empty' }
  | { kind: 'plot'; side: Side; slot: number; building?: Building }
  | { kind: 'unit'; side: Side; unit: Unit }
  | { kind: 'worker'; side: Side; index: number }
  | { kind: 'base'; side: Side; player: Player };

export function resolveSelection(game: GameState, selection: MapSelection): SelectedEntity {
  if (!selection) return { kind: 'empty' };
  if (selection.kind === 'hero') {
    const record = game.players[selection.side].heroes?.find(
      (record) => record.hero === selection.hero,
    );
    if (!record) return { kind: 'empty' };
    const unit = game.units.find(
      (unit) =>
        unit.side === selection.side &&
        unit.kind === 'hero' &&
        unit.hero === selection.hero &&
        unit.hp > 0,
    );
    return unit
      ? { kind: 'unit', side: selection.side, unit }
      : { kind: 'hero', side: selection.side, record };
  }
  if (selection.kind === 'unit') {
    const unit = game.units.find((candidate) => candidate.id === selection.id);
    return unit ? { kind: 'unit', side: unit.side, unit } : { kind: 'empty' };
  }
  if (selection.kind === 'worker')
    return Number.isInteger(selection.index) &&
      selection.index >= 0 &&
      selection.index < game.players[selection.side].workers
      ? selection
      : { kind: 'empty' };
  if (selection.kind === 'base') return { ...selection, player: game.players[selection.side] };
  if (
    !battlefieldLayout(game.battlefield).plots[selection.side].some(
      ({ slot }) => slot === selection.slot,
    )
  )
    return { kind: 'empty' };
  return {
    ...selection,
    building: game.players[selection.side].buildings.find(
      (candidate) => candidate.slot === selection.slot,
    ),
  };
}

// Hotkeys follow the selected object, exactly like the visible command card.
export function selectionCommand(
  game: GameState,
  side: Side,
  selection: MapSelection,
  key: string,
): Command | null {
  const entity = resolveSelection(game, selection);
  if (entity.kind === 'empty' || entity.side !== side) return null;
  if (entity.kind === 'base') {
    if (key === 'r') return { type: 'worker' };

    const roster = heroRoster(side);
    const keys = assignHotkeys(
      roster.map((hero) => HEROES[hero].name),
      ['l', 'r', 'c'],
    );
    const hero = roster[keys.indexOf(key)];
    return hero ? (hero === DEFAULT_HERO[side] ? { type: 'hero' } : { type: 'hero', hero }) : null;
  }
  if (entity.kind !== 'plot') return null;
  if (entity.building) {
    if (key === 'c' && entity.building.kind === 'hospital' && isBuildingReady(entity.building))
      return { type: 'medic', slot: entity.slot };
    if (key === 'd') return { type: 'demolish', slot: entity.slot };
    if (
      key === 'p' &&
      isBuildingReady(entity.building) &&
      BUILDINGS[entity.building.kind].interval > 0
    )
      return { type: 'auto-production', slot: entity.slot, paused: !entity.building.autoPaused };
  }
  if (entity.building)
    return key === 'l' &&
      canUpgradeBuilding(entity.building.kind) &&
      isBuildingReady(entity.building) &&
      !entity.building.upgrading
      ? { type: 'upgrade', slot: entity.slot }
      : null;
  if (!ownsPlot(game.players[side], entity.slot))
    return key === 'a' ? { type: 'buy-plot', slot: entity.slot } : null;
  const kind = (
    Object.keys(BUILDING_HOTKEYS[side]) as (keyof (typeof BUILDING_HOTKEYS)[typeof side])[]
  ).find((kind) => BUILDING_HOTKEYS[side][kind] === key);
  return kind && !missingBuildingRequirements(game.players[side], kind).length
    ? { type: 'build', kind, slot: entity.slot }
    : null;
}
