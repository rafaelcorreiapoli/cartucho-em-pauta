import type { GameState, Unit } from './model';
export const MEDIC = {
  name: 'Médico Cubano',
  cost: 220,
  duration: 10,
  population: 2,
  healing: 5,
  cycle: 1,
  radius: 140,
} as const;
export function medicDestination(game: GameState, medic: Unit) {
  const direction = medic.side === 'left' ? 1 : -1,
    allies = game.units.filter(
      (unit) => unit.side === medic.side && unit.kind !== 'medic' && unit.hp > 0,
    );
  const lead = allies.reduce(
    (best, unit) => (direction * unit.x > direction * best ? unit.x : best),
    medic.side === 'left' ? 140 : 860,
  );
  let destination = lead - direction * 60;
  const enemies = game.units.filter((unit) => unit.side !== medic.side && unit.hp > 0),
    closest = enemies.sort((a, b) => Math.abs(a.x - medic.x) - Math.abs(b.x - medic.x))[0];
  if (closest && Math.abs(closest.x - medic.x) < 160)
    destination =
      direction === 1
        ? Math.min(destination, closest.x - 110)
        : Math.max(destination, closest.x + 110);
  return Math.max(80, Math.min(920, destination));
}
/** Each medic spends one cycle on one injured ally; overlapping doctors do not stack on that ally. */
export function stepHealing(game: GameState, dt: number) {
  const medics = game.units
    .filter((unit) => unit.kind === 'medic' && unit.hp > 0)
    .sort((a, b) => a.id - b.id);
  for (const medic of medics) {
    medic.healingCooldown = Math.max(0, (medic.healingCooldown ?? MEDIC.cycle) - dt);
    const previous = game.units.find(
      (unit) =>
        unit.id === medic.healingTargetId &&
        unit.hp > 0 &&
        Math.hypot(unit.x - medic.x, (unit.row - medic.row) * 7.5) <= MEDIC.radius,
    );
    medic.attacking = !!previous && medic.healingCooldown > 0;
    if (!previous) medic.healingTargetId = 0;
    if (medic.healingCooldown > 1e-8) continue;
    const target = game.units
      .filter(
        (unit) =>
          unit.side === medic.side &&
          unit.hp > 0 &&
          unit.hp < unit.maxHp &&
          (unit.healingLockUntil ?? 0) <= game.time + 1e-8 &&
          Math.hypot(unit.x - medic.x, (unit.row - medic.row) * 7.5) <= MEDIC.radius,
      )
      .sort(
        (a, b) =>
          a.hp / a.maxHp - b.hp / b.maxHp ||
          Math.abs(a.x - medic.x) - Math.abs(b.x - medic.x) ||
          a.id - b.id,
      )[0];
    medic.healingTargetId = target?.id ?? 0;
    medic.attacking = !!target;
    if (!target) continue;
    target.hp = Math.min(target.maxHp, target.hp + MEDIC.healing);
    target.healingLockUntil = game.time + MEDIC.cycle;
    medic.healingCooldown = MEDIC.cycle;
  }
}
