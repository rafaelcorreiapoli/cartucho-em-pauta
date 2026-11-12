import { isBuildingReady } from './buildings';
import { FACTIONS, type Side } from './content';
import { normalizeHeroes } from './hero-progression';
import { DEFAULT_HERO, heroIdentity, type HeroKind } from './heroes';
import type { GameState, Player } from './model';
import { populationCapacity } from './population';

export function queuedWorkers(player: Player) {
  return (player.trainingQueue ?? []).filter((order) => order.kind === 'worker').length;
}
export function heroQueued(player: Player, hero?: HeroKind, side: Side = 'left') {
  return (player.trainingQueue ?? []).some(
    (order) => order.kind === 'hero' && (!hero || (order.hero ?? DEFAULT_HERO[side]) === hero),
  );
}
export function heroAlive(game: GameState, side: Side, hero?: HeroKind) {
  return game.units.some(
    (u) => u.side === side && u.kind === 'hero' && (!hero || heroIdentity(u) === hero),
  );
}
export function heroRecruitmentBuildingRequirements(player: Player): ('civic' | 'academy')[] {
  return (player.heroes?.length ?? 0) >= 1 ? ['civic', 'academy'] : ['civic'];
}
export function heroRecruitmentRequirements(player: Player, side: Side) {
  const requirements = heroRecruitmentBuildingRequirements(player)
    .filter(
      (kind) =>
        !player.buildings.some((building) => building.kind === kind && isBuildingReady(building)),
    )
    .map(
      (kind) =>
        `${FACTIONS[side].buildings[kind]} ${kind === 'academy' ? 'concluída' : 'concluído'}`,
    );
  const acquired = player.heroes?.length ?? 0;
  if (acquired >= 2 && populationCapacity(player) < 100)
    requirements.push('100 de população máxima');
  return requirements;
}
export function heroCount(game: GameState, side: Side) {
  normalizeHeroes(game, side);
  return game.players[side].heroes.length;
}
