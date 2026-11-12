import { describe, expect, it } from 'vitest';
import {
  BUILDING_REQUIREMENTS,
  BUILDINGS,
  civicPopularityRate,
  createGame,
  execute,
  GLOBAL_POWER,
  isBuildingReady,
  POPULARITY_CAP,
  popularityRate,
  spawnUnit,
  step,
  type BuildingKind,
} from './index';
const advance = (game: ReturnType<typeof createGame>, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 20); i++) step(game, 0.05);
};
function emptyGame() {
  const game = createGame();
  for (const player of Object.values(game.players))
    player.unlockedPowers = ['bills', 'recall', 'silence', 'strength'];
  game.players.left.buildings = [];
  game.players.right.buildings = [];
  return game;
}

describe('tempo de construção', () => {
  for (const kind of Object.keys(BUILDINGS) as BuildingKind[])
    it(`${kind}: reserva terreno, cobra e só produz após concluir`, () => {
      const game = emptyGame();
      const spec = BUILDINGS[kind],
        initialCash = Math.max(600, spec.cost);
      game.players.left.cash = initialCash;
      for (const required of BUILDING_REQUIREMENTS[kind] ?? [])
        game.players.left.buildings.push({
          kind: required,
          slot: 5,
          level: 1,
          progress: 0,
          constructionProgress: 1,
          completedCycles: 0,
          autoPaused: true,
        });
      expect(execute(game, 'left', { type: 'build', kind, slot: 1 })).toBeNull();
      const building = game.players.left.buildings.find((b) => b.slot === 1)!,
        baselineRate = popularityRate(game.players.left);
      expect(game.players.left.cash).toBe(initialCash - spec.cost);
      expect(building.constructionProgress).toBe(0);
      expect(building.progress).toBe(0);
      expect(building.completedCycles).toBe(0);
      expect(execute(game, 'left', { type: 'build', kind, slot: 1 })).toMatch(/ocupado/);
      expect(execute(game, 'left', { type: 'upgrade', slot: 1 })).toMatch(
        /construção|indisponível/,
      );
      advance(game, spec.constructionTime - 0.05);
      expect(isBuildingReady(building)).toBe(false);
      expect(game.units).toHaveLength(0);
      expect(game.players.left.popularity).toBeCloseTo(
        baselineRate * (spec.constructionTime - 0.05),
      );
      advance(game, 0.05);
      expect(isBuildingReady(building)).toBe(true);
      expect(building.progress).toBeCloseTo(0);
      expect(building.completedCycles).toBe(spec.popularityYield > 0 ? 1 : 0);
      advance(game, spec.interval);
      expect(building.completedCycles).toBe(spec.unit || spec.popularityYield > 0 ? 1 : 0);
      if (spec.unit) expect(game.units[0]).toMatchObject({ side: 'left', kind: spec.unit });
      else {
        expect(game.units).toHaveLength(0);
        expect(game.players.left.popularity).toBeCloseTo(
          baselineRate * (spec.constructionTime + spec.interval) + spec.popularityYield,
        );
      }
    });
  it('não avança obra em partida pausada/aguardando nem altera prédio inicial pronto', () => {
    const game = createGame();
    for (const player of Object.values(game.players))
      player.unlockedPowers = ['bills', 'recall', 'silence', 'strength'];
    expect(isBuildingReady(game.players.left.buildings[0])).toBe(true);
    execute(game, 'left', { type: 'build', kind: 'media', slot: 1 });
    game.status = 'waiting';
    advance(game, 10);
    expect(game.players.left.buildings[1].constructionProgress).toBe(0);
  });
});

describe('popularidade', () => {
  it('mantém o rendimento fixo da estrutura e respeita o limite de armazenamento', () => {
    const game = emptyGame();
    execute(game, 'left', { type: 'build', kind: 'civic', slot: 1 });
    advance(game, BUILDINGS.civic.constructionTime + BUILDINGS.civic.interval);
    const building = game.players.left.buildings[0];
    expect(game.players.left.popularity).toBeCloseTo(6);
    expect(execute(game, 'left', { type: 'upgrade', slot: 1 })).toMatch(/indisponível/);
    expect(civicPopularityRate(building)).toBeCloseTo(0.6);
    advance(game, 10);
    expect(civicPopularityRate(building)).toBeCloseTo(0.6);
    advance(game, 10);
    expect(game.players.left.popularity).toBeCloseTo(18);
    game.players.left.popularity = POPULARITY_CAP - 1;
    advance(game, 10);
    expect(game.players.left.popularity).toBe(POPULARITY_CAP);
  });
});

describe('Chuva de boletos', () => {
  it('atinge todos os inimigos com 40% da vida máxima, sem atingir aliados ou bases', () => {
    const game = emptyGame();
    spawnUnit(game, 'left', 'front');
    spawnUnit(game, 'right', 'front');
    spawnUnit(game, 'right', 'hero');
    const ally = game.units[0];
    const targets = game.units.slice(1);
    const hp = ally.hp;
    const base = game.players.right.baseHp;
    game.players.left.popularity = GLOBAL_POWER.cost;
    expect(execute(game, 'left', { type: 'power' })).toBeNull();
    for (const target of targets) expect(target.hp).toBeCloseTo(target.maxHp * 0.6);
    expect(ally.hp).toBe(hp);
    expect(game.players.right.baseHp).toBe(base);
    expect(game.players.left.popularity).toBe(0);
    expect(game.players.left.powerCooldowns.bills).toBe(GLOBAL_POWER.cooldown);
    expect(game.powers[0].targets.map((target) => target.id)).toEqual(
      targets.map((target) => target.id),
    );
  });
  it('não gasta popularidade quando falta recurso, está em recarga ou não há alvos', () => {
    const game = emptyGame();
    expect(execute(game, 'left', { type: 'power' })).toMatch(/Popularidade insuficiente/);
    game.players.left.popularity = GLOBAL_POWER.cost;
    expect(execute(game, 'left', { type: 'power' })).toMatch(/Nenhuma unidade/);
    expect(game.players.left.popularity).toBe(GLOBAL_POWER.cost);
    spawnUnit(game, 'right', 'front');
    game.players.left.powerCooldowns.bills = 2;
    expect(execute(game, 'left', { type: 'power' })).toMatch(/recarregando/);
    expect(game.players.left.popularity).toBe(GLOBAL_POWER.cost);
    advance(game, 2);
    expect(game.players.left.powerCooldowns.bills).toBeCloseTo(0);
    expect(execute(game, 'left', { type: 'power' })).toBeNull();
  });
  it('remove derrotados, contabiliza baixas e descarta eventos visuais antigos', () => {
    const game = emptyGame();
    spawnUnit(game, 'right', 'front');
    game.units[0].hp = 20;
    game.players.left.popularity = 60;
    execute(game, 'left', { type: 'power' });
    expect(game.units).toHaveLength(0);
    expect(game.players.left.kills).toBe(1);
    advance(game, 3.1);
    expect(game.powers).toHaveLength(0);
  });
});
