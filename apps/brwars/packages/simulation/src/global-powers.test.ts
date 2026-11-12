import { describe, expect, it } from 'vitest';
import { BUILDING_SLOTS, UNITS, createGame, execute, spawnUnit, step } from './index';
const advance = (game: ReturnType<typeof createGame>, seconds: number) => {
  for (let i = 0; i < seconds * 20; i++) step(game, 0.05);
};
function setup() {
  const game = createGame();
  for (const player of Object.values(game.players))
    player.unlockedPowers = ['bills', 'recall', 'silence', 'strength'];
  game.players.left.baseAttackCooldown = 100000;
  game.players.right.baseAttackCooldown = 100000;
  game.players.left.buildings = [];
  game.players.right.buildings = [];
  game.players.left.popularity = 200;
  return game;
}
describe('poderes globais', () => {
  for (const side of ['left', 'right'] as const)
    it(`recuo devolve metade do avanço de cada inimigo: ${side}`, () => {
      const game = setup();
      game.players[side].popularity = 200;
      spawnUnit(game, 'left', 'front');
      spawnUnit(game, 'right', 'hero');
      game.units.forEach((unit) => (unit.x = 500));
      const ally = game.units.find((unit) => unit.side === side)!,
        enemy = game.units.find((unit) => unit.side !== side)!;
      const hp = enemy.hp;
      expect(execute(game, side, { type: 'power', kind: 'recall' })).toBeNull();
      expect(enemy.x).toBe(enemy.side === 'left' ? 325 : 675);
      expect(ally.x).toBe(500);
      expect(enemy.hp).toBe(hp);
      expect(game.powers[0].kind).toBe('recall');
    });
  it('silêncio bloqueia ataques contra tropas e bases e expira', () => {
    const game = setup();
    spawnUnit(game, 'right', 'front');
    const enemy = game.units[0];
    enemy.x = 80;
    enemy.cooldown = 0;
    expect(execute(game, 'left', { type: 'power', kind: 'silence' })).toBeNull();
    const hp = game.players.left.baseHp;
    advance(game, 5.9);
    expect(game.players.left.baseHp).toBe(hp);
    expect(game.hits).toHaveLength(0);
    advance(game, 0.2);
    expect(game.players.left.baseHp).toBeLessThan(hp);
    const combat = setup();
    spawnUnit(combat, 'left', 'front');
    spawnUnit(combat, 'right', 'front');
    combat.units.forEach((unit) => {
      unit.x = 500;
      unit.cooldown = 0;
    });
    execute(combat, 'left', { type: 'power', kind: 'silence' });
    step(combat, 0.05);
    expect(combat.hits.map((hit) => hit.side)).toEqual(['left']);
  });
  it('força dobra apenas o dano aliado por 10s sem alterar vida ou futuras tropas', () => {
    const game = setup();
    spawnUnit(game, 'left', 'front');
    const unit = game.units[0];
    unit.x = 920;
    unit.cooldown = 0;
    const hp = unit.hp;
    expect(execute(game, 'left', { type: 'power', kind: 'strength' })).toBeNull();
    step(game, 0.05);
    expect(game.hits[0].damage).toBe(UNITS.front.damage * 2);
    expect(unit.hp).toBe(hp);
    spawnUnit(game, 'left', 'ranged');
    expect(game.units[1].strengthUntil).toBe(0);
    advance(game, 10);
    unit.cooldown = 0;
    step(game, 0.05);
    expect(game.hits.filter((hit) => hit.sourceId === unit.id).at(-1)?.damage).toBe(
      UNITS.front.damage,
    );
  });
  it('valida identificação, alvos, custo e recarga individual sem cobrar ações inválidas', () => {
    const game = setup();
    expect(execute(game, 'left', { type: 'power', kind: '__proto__' })).toMatch(/inválido/);
    expect(execute(game, 'left', { type: 'power', kind: 'strength' })).toMatch(/aliada/);
    expect(game.players.left.popularity).toBe(200);
    spawnUnit(game, 'left', 'front');
    spawnUnit(game, 'right', 'front');
    execute(game, 'left', { type: 'power', kind: 'strength' });
    expect(game.players.left.popularity).toBe(125);
    expect(execute(game, 'left', { type: 'power', kind: 'strength' })).toMatch(/recarregando/);
    expect(execute(game, 'left', { type: 'power', kind: 'recall' })).toBeNull();
    expect(game.players.left.powerCooldowns).toMatchObject({
      strength: 45,
      recall: 45,
      bills: 0,
      silence: 0,
    });
  });
});
describe('48 terrenos por lado', () => {
  it('permite o último terreno, rejeita índices fora do mapa e ocupados', () => {
    const game = setup();
    expect(BUILDING_SLOTS).toBe(48);
    game.players.left.cash = 1000;
    expect(execute(game, 'left', { type: 'buy-plot', slot: 47 })).toBeNull();
    expect(execute(game, 'left', { type: 'build', kind: 'civic', slot: 47 })).toBeNull();
    expect(execute(game, 'left', { type: 'build', kind: 'media', slot: 47 })).toMatch(/ocupado/);
    expect(execute(game, 'left', { type: 'build', kind: 'media', slot: 48 })).toMatch(/inválido/);
  });
});

it('recargas diminuem independentemente, param na pausa e não vazam entre jogadores', () => {
  const game = setup(),
    p = game.players.left;
  spawnUnit(game, 'left', 'front');
  spawnUnit(game, 'right', 'front');
  execute(game, 'left', { type: 'power', kind: 'strength' });
  advance(game, 5);
  execute(game, 'left', { type: 'power', kind: 'recall' });
  expect(p.powerCooldowns.strength).toBeCloseTo(40);
  expect(p.powerCooldowns.recall).toBe(45);
  expect(game.players.right.powerCooldowns.strength).toBe(0);
  game.status = 'waiting';
  advance(game, 2);
  expect(p.powerCooldowns.strength).toBeCloseTo(40);
  game.status = 'playing';
  advance(game, 40);
  expect(p.powerCooldowns.strength).toBeCloseTo(0);
  expect(p.powerCooldowns.recall).toBeCloseTo(5);
  spawnUnit(game, 'left', 'front');
  p.popularity = 200;
  expect(execute(game, 'left', { type: 'power', kind: 'strength' })).toBeNull();
  expect(execute(game, 'left', { type: 'power', kind: 'recall' })).toMatch(/recarregando/);
});

it.each([
  [0, 0],
  [2, 2],
  [9, 3],
  [10, 4],
  [19, 4],
  [20, 5],
])('Corte de Ponto causa %s → %s baixas sem exigir tropas no campo', (workers, losses) => {
  const game = createGame();
  const caster = game.players.right;
  const victim = game.players.left;
  caster.unlockedPowers = ['sabotage'];
  caster.popularity = 110;
  victim.workers = workers;
  const ownWorkers = caster.workers;
  const result = execute(game, 'right', { type: 'power', kind: 'sabotage' });
  expect(caster.workers).toBe(ownWorkers);
  expect(victim.workers).toBe(workers - losses);
  if (losses === 0) {
    expect(result).toMatch(/Nenhum trabalhador/);
    expect(caster.popularity).toBe(110);
    expect(caster.powerCooldowns.sabotage).toBe(0);
    expect(game.powers).toHaveLength(0);
  } else {
    expect(result).toBeNull();
    expect(caster.popularity).toBe(0);
    expect(caster.powerCooldowns.sabotage).toBe(90);
    expect(game.powers[0]).toMatchObject({ kind: 'sabotage', workerLoss: losses, targets: [] });
  }
});
