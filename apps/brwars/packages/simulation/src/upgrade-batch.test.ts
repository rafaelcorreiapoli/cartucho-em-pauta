import { describe, expect, it } from 'vitest';
import { buildingUpgradeBatches, createGame, execute, MAX_BUILDING_LEVEL, step } from './index';

function setup(cash: number) {
  const game = createGame();
  const player = game.players.right;
  const prototype = player.buildings[0]!;
  player.buildings = [4, 1, 3, 2, 0].map((slot) => ({ ...prototype, slot }));
  player.cash = cash;
  return { game, player, kind: prototype.kind };
}

describe('melhorias em lote', () => {
  it.each([
    [160, []],
    [320, [0, 1]],
    [800, [0, 1, 2, 3, 4]],
  ] as const)('com R$ %i inicia apenas as melhorias que cabem no saldo', (cash, slots) => {
    const { game, player, kind } = setup(cash);
    expect(
      buildingUpgradeBatches(player).flatMap((batch) => batch.buildings.map((b) => b.slot)),
    ).toEqual(slots);
    const result = execute(game, 'right', { type: 'upgrade-batch', kind });
    expect(result === null).toBe(slots.length >= 2);
    expect(player.cash).toBe(cash - 160 * slots.length);
    expect(
      player.buildings
        .filter((b) => b.upgrading)
        .map((b) => b.slot)
        .sort(),
    ).toEqual(slots);
    expect(player.buildings.every((b) => b.level === 1)).toBe(true);
    step(game, 0.05, 'right');
    expect(
      player.buildings
        .filter((b) => b.level === 2)
        .map((b) => b.slot)
        .sort(),
    ).toEqual(slots);
  });

  it('ignora outros tipos, obras e prédios no nível máximo e revalida o saldo em cada comando', () => {
    const { game, player, kind } = setup(480);
    const prototype = player.buildings[0]!;
    player.buildings.push(
      { ...prototype, slot: 5, kind: 'housing' },
      { ...prototype, slot: 6, level: 2 },
      { ...prototype, slot: 7, upgrading: true },
      { ...prototype, slot: 8, constructionProgress: 0.9 },
      { ...prototype, slot: 9, level: MAX_BUILDING_LEVEL },
    );
    expect(execute(game, 'right', { type: 'upgrade-batch', kind, level: '1' })).toMatch(/inválido/);
    expect(execute(game, 'right', { type: 'upgrade-batch', kind })).toBeNull();
    expect(execute(game, 'right', { type: 'upgrade-batch', kind })).toMatch(/duas/);
    expect(player.cash).toBe(0);
    expect(
      player.buildings
        .filter((b) => b.upgrading)
        .map((b) => b.slot)
        .sort(),
    ).toEqual([0, 1, 2, 7]);
    expect(game.players.left.buildings.every((b) => !b.upgrading)).toBe(true);
  });

  it('combina níveis no mesmo lote, prioriza os menores e evolui cada prédio uma vez', () => {
    const { game, player, kind } = setup(750);
    const originalLevels = [3, 2, 1, 2, 1];
    for (const building of player.buildings) building.level = originalLevels[building.slot]!;
    const batches = buildingUpgradeBatches(player);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.buildings.map((b) => b.slot)).toEqual([2, 4, 1]);
    expect(batches[0]?.totalCost).toBe(580);
    expect(execute(game, 'right', { type: 'upgrade-batch', kind })).toBeNull();
    expect(player.cash).toBe(170);
    step(game, 0.05, 'right');
    expect([...player.buildings].sort((a, b) => a.slot - b.slot).map((b) => b.level)).toEqual([
      3, 3, 2, 2, 2,
    ]);
  });

  it('respeita o nível explícito enviado por um cliente antigo', () => {
    const { game, player, kind } = setup(900);
    player.buildings.find((b) => b.slot === 0)!.level = 2;
    player.buildings.find((b) => b.slot === 3)!.level = 2;
    expect(execute(game, 'right', { type: 'upgrade-batch', kind, level: 2 })).toBeNull();
    expect(
      player.buildings
        .filter((b) => b.upgrading)
        .map((b) => b.slot)
        .sort(),
    ).toEqual([0, 3]);
    expect(player.cash).toBe(380);
  });
});
