import { describe, expect, it } from 'vitest';
import {
  BASE_HP,
  BUILDINGS,
  MAX_POPULATION,
  botAct,
  createGame,
  execute,
  maxBaseHp,
  spawnUnit,
  step,
  type Side,
} from './index';
function advance(game: ReturnType<typeof createGame>, seconds: number) {
  for (let i = 0; i < seconds * 20; i++) step(game, 0.05);
}
describe('economia autoritativa', () => {
  it('contrata trabalhadores, aumenta renda e limita contratações', () => {
    const game = createGame();
    expect(execute(game, 'left', { type: 'worker' })).toBeNull();
    expect(game.players.left.cash).toBe(480);
    advance(game, 1);
    expect(game.players.left.workers).toBe(3);
    expect(game.players.left.cash).toBeCloseTo(457);
    advance(game, 4);
    expect(game.players.left.workers).toBe(4);
    game.players.left.cash = 100000;
    for (let i = 0; i < 20; i++) {
      execute(game, 'left', { type: 'worker' });
      advance(game, 5);
    }
    expect(game.players.left.workers).toBe(12);
  });
});
describe('construção e validação de comandos', () => {
  it('rejeita comandos malformados sem modificar caixa ou terreno', () => {
    const game = createGame();
    for (const command of [
      null,
      [],
      {},
      { type: 'build', kind: '__proto__', slot: 2 },
      { type: 'build', kind: 'media', slot: -1 },
      { type: 'build', kind: 'media', slot: 48 },
      { type: 'build', kind: 'media', slot: 1.5 },
      { type: 'build', kind: 'media', slot: 0 },
      { type: 'cash', amount: 99999 },
    ])
      expect(execute(game, 'left', command)).toBeTruthy();
    expect(game.players.left.cash).toBe(600);
    expect(game.players.left.buildings).toHaveLength(1);
  });
  it('desconta construção e faz upgrades apenas nas tropas futuras', () => {
    const game = createGame();
    expect(execute(game, 'left', { type: 'build', kind: 'media', slot: 1 })).toBeNull();
    expect(game.players.left.cash).toBe(600 - BUILDINGS.media.cost);
    spawnUnit(game, 'left', 'front');
    execute(game, 'left', { type: 'upgrade', slot: 0 });
    expect(game.units[0].level).toBe(1);
    advance(game, 13);
    expect(game.units.some((u) => u.side === 'left' && u.kind === 'front' && u.level === 2)).toBe(
      true,
    );
  });
  it('não permite gastar dinheiro inexistente nem comandar partida encerrada', () => {
    const game = createGame();
    game.players.left.buildings.push({
      kind: 'civic',
      slot: 47,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
      autoPaused: true,
    });
    game.players.left.cash = 0;
    for (const command of [
      { type: 'worker' },
      { type: 'build', kind: 'garage', slot: 2 },
      { type: 'upgrade', slot: 0 },
    ])
      expect(execute(game, 'left', command)).toMatch(/insuficientes/);
    game.status = 'finished';
    expect(execute(game, 'left', { type: 'loan' })).toMatch(/andamento/);
  });
});
describe('produção e combate', () => {
  it('produz tropas sozinho e respeita o limite por lado', () => {
    const game = createGame();
    advance(game, 5);
    expect(game.units.filter((u) => u.side === 'left')).toHaveLength(1);
    for (let i = 0; i < 100; i++) spawnUnit(game, 'left', 'front');
    expect(game.units.filter((u) => u.side === 'left')).toHaveLength(8);
    game.players.left.buildings.push({
      kind: 'civic',
      slot: 47,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
      autoPaused: true,
    });
    game.players.left.cash = 1000;
    expect(execute(game, 'left', { type: 'hero' })).toBeNull();
    expect(game.players.left.trainingQueue[0].populationReserved).not.toBe(true);
    expect(game.players.left.cash).toBe(1000);
  });
  it('exige contratação manual de herói e impede duplicatas', () => {
    const game = createGame();
    game.players.left.buildings.push({
      kind: 'civic',
      slot: 47,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
      autoPaused: true,
    });
    execute(game, 'left', { type: 'hero' });
    expect(game.players.left.cash).toBe(600);
    expect(execute(game, 'left', { type: 'hero' })).toMatch(/indisponível/);
    expect(game.units.filter((u) => u.kind === 'hero')).toHaveLength(0);
    advance(game, 12);
    expect(game.units.filter((u) => u.kind === 'hero')).toHaveLength(1);
  });
  it('resolve dano simultâneo sem favorecer a ordem de iteração', () => {
    const game = createGame();
    for (const side of ['left', 'right'] as Side[]) game.players[side].buildings = [];
    spawnUnit(game, 'left', 'front');
    spawnUnit(game, 'right', 'front');
    for (const unit of game.units) {
      unit.x = 500;
      unit.hp = 15;
      unit.cooldown = 0;
    }
    step(game, 0.05);
    expect(game.units).toHaveLength(0);
    expect(game.players.left.kills).toBe(1);
    expect(game.players.right.kills).toBe(1);
  });
  it('cerco causa dano dobrado à base e encerra a partida', () => {
    const game = createGame();
    game.players.left.buildings = [];
    game.players.right.buildings = [];
    spawnUnit(game, 'left', 'siege');
    game.units[0].x = 900;
    game.units[0].cooldown = 0;
    game.players.right.baseHp = 52;
    step(game, 0.05);
    expect(game.players.right.baseHp).toBe(0);
    expect(game.winner).toBe('left');
    expect(game.status).toBe('finished');
    const time = game.time;
    advance(game, 2);
    expect(game.time).toBe(time);
  });
  it('não avança partida em espera nem aceita passos inválidos', () => {
    const game = createGame('waiting');
    advance(game, 5);
    expect(game.time).toBe(0);
    game.status = 'playing';
    for (const dt of [NaN, Infinity, -1, 0, 1]) step(game, dt);
    expect(game.time).toBe(0);
  });
  it('simula dez minutos entre bots com estado finito, exércitos limitados e resultado apenas por destruição', () => {
    const game = createGame();
    for (let i = 0; i < 12020 && game.status !== 'finished'; i++) {
      if (i % 80 === 0) {
        botAct(game, 'left');
        botAct(game, 'right');
      }
      step(game, 0.05);
    }
    if (game.status === 'finished')
      expect(Math.min(game.players.left.baseHp, game.players.right.baseHp)).toBe(0);
    else expect(game.winner).toBeNull();
    for (const side of ['left', 'right'] as Side[]) {
      expect(Number.isFinite(game.players[side].cash)).toBe(true);
      expect(game.players[side].baseHp).toBeLessThanOrEqual(maxBaseHp(game.players[side]));
    }
    expect(game.units.length).toBeLessThanOrEqual(MAX_POPULATION * 2);
  });
});

describe('eventos visuais de combate', () => {
  it('publica origem, alvo e tipo apenas quando o ataque causa dano', () => {
    const game = createGame();
    game.players.left.buildings = [];
    game.players.right.buildings = [];
    spawnUnit(game, 'left', 'ranged');
    spawnUnit(game, 'right', 'front');
    game.units[0].x = 450;
    game.units[1].x = 500;
    for (const unit of game.units) unit.cooldown = 0;
    step(game, 0.05);
    expect(game.hits).toHaveLength(1);
    expect(game.hits[0]).toMatchObject({
      kind: 'ranged',
      sourceId: game.units[0].id,
      targetId: game.units[1].id,
      side: 'left',
    });
    expect(game.units[1].hp).toBe(game.units[1].maxHp - game.hits[0].damage);
    step(game, 0.05);
    expect(game.hits).toHaveLength(1);
    game.units = [];
    advance(game, 2);
    expect(game.hits).toHaveLength(0);
  });
  it('mantém eventos limitados mesmo com dois exércitos grandes em combate', () => {
    const game = createGame();
    game.players.left.buildings = [];
    game.players.right.buildings = [];
    for (let i = 0; i < 60; i++)
      for (const side of ['left', 'right'] as Side[]) spawnUnit(game, side, 'front');
    for (const unit of game.units) {
      unit.x = 500;
      unit.cooldown = 0;
    }
    step(game, 0.05);
    expect(game.hits.length).toBeLessThanOrEqual(80);
  });
});

describe('progressão de construções', () => {
  it('permite chegar ao nível 15 e recusa gastar além do limite', () => {
    const game = createGame();
    game.players.left.cash = 1000000;
    game.players.right.buildings = [];
    game.players.left.buildings[0].kind = 'barracks';
    game.players.left.buildings[0].autoPaused = true;
    for (let level = 1; level < 15; level++) {
      expect(execute(game, 'left', { type: 'upgrade', slot: 0 })).toBeNull();
      advance(game, 8 + level * 2);
    }
    expect(game.players.left.buildings[0].level).toBe(15);
    const remaining = game.players.left.cash;
    expect(execute(game, 'left', { type: 'upgrade', slot: 0 })).toMatch(/indisponível/);
    expect(game.players.left.cash).toBe(remaining);
    game.players.left.buildings[0].kind = 'barracks';
    game.players.left.buildings[0].autoPaused = false;
    game.players.left.buildings[0].progress = 4;
    advance(game, 5);
    const unit = game.units.find((unit) => unit.side === 'left');
    expect(unit?.level).toBe(15);
    expect(unit?.maxHp).toBeCloseTo(125 * (1 + 14 * 0.05));
  });
});

describe('fim de partida por destruição da base', () => {
  for (const side of ['left', 'right'] as Side[])
    it(`não derrota ${side} ao atingir dez minutos, mesmo tendo menos vida e atacando a base inimiga`, () => {
      const game = createGame(),
        enemy = side === 'left' ? 'right' : 'left';
      for (const p of Object.values(game.players)) p.buildings = [];
      game.time = 599.95;
      game.players[side].baseHp = 500;
      game.players[enemy].baseHp = 1500;
      spawnUnit(game, side, 'siege');
      game.units[0].x = side === 'left' ? 900 : 100;
      game.units[0].cooldown = 0;
      step(game, 0.1);
      expect(game.time).toBeGreaterThan(600);
      expect(game.status).toBe('playing');
      expect(game.winner).toBeNull();
      expect(game.players[side].baseHp).toBe(500);
      expect(game.players[enemy].baseHp).toBe(1448);
    });
  it('bases sem ataque não perdem vida por tempo, inclusive após oito e dez minutos', () => {
    const game = createGame();
    for (const p of Object.values(game.players)) p.buildings = [];
    for (const time of [479.95, 599.95, 1200]) {
      game.time = time;
      step(game, 0.1);
      expect(game.players.left.baseHp).toBe(BASE_HP);
      expect(game.players.right.baseHp).toBe(BASE_HP);
      expect(game.status).toBe('playing');
      expect(game.winner).toBeNull();
    }
  });
  it('destruição simultânea das duas bases resulta em empate e congela o estado', () => {
    const game = createGame();
    for (const side of ['left', 'right'] as Side[]) {
      game.players[side].buildings = [];
      game.players[side].baseHp = 52;
      spawnUnit(game, side, 'siege');
      game.units.at(-1)!.x = side === 'left' ? 900 : 100;
      game.units.at(-1)!.cooldown = 0;
    }
    step(game, 0.05);
    expect(game.players.left.baseHp).toBe(0);
    expect(game.players.right.baseHp).toBe(0);
    expect(game.status).toBe('finished');
    expect(game.winner).toBe('draw');
    const time = game.time;
    step(game, 0.05);
    expect(game.time).toBe(time);
  });
});
