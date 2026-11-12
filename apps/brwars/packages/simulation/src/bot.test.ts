import { expect, it } from 'vitest';
import {
  botAct,
  createGame,
  createHeroRecord,
  populationCapacity,
  populationUsed,
  spawnUnit,
  step,
  type Side,
} from './index';
it('evolui economia, pesquisa, exército e terrenos durante partidas longas nas duas facções', () => {
  const g = createGame();
  for (const p of Object.values(g.players)) p.baseHp = 1000000;
  for (let i = 0; i < 9600; i++) {
    if (i % 80 === 0) {
      botAct(g, 'left');
      botAct(g, 'right');
    }
    step(g, 0.05);
  }
  for (const side of ['left', 'right'] as Side[]) {
    const p = g.players[side];
    expect(p.workers).toBeGreaterThan(8);
    expect(p.research.length).toBeGreaterThan(3);
    expect(p.heroes.length).toBeGreaterThan(0);
    expect(p.heroes.length).toBeLessThanOrEqual(3);
    expect(p.ownedPlots.length).toBeGreaterThan(6);
    for (const kind of ['school', 'academy', 'hospital', 'media', 'garage'])
      expect(p.buildings.some((b) => b.kind === kind)).toBe(true);
    expect(p.cash).toBeGreaterThanOrEqual(0);
    expect(p.popularity).toBeGreaterThan(-100);
    expect(populationUsed(g, side)).toBeLessThanOrEqual(populationCapacity(p));
  }
});
it('usa recall ao ser pressionada, sem gastar magia em campo vazio e respeita estado da partida', () => {
  const g = createGame();
  g.players.right.unlockedPowers = ['recall'];
  g.players.right.popularity = 200;
  g.players.right.cash = 0;
  botAct(g, 'right');
  expect(g.powers).toHaveLength(0);
  for (let i = 0; i < 4; i++) {
    spawnUnit(g, 'left', 'front');
    g.units.at(-1)!.x = 860;
  }
  botAct(g, 'right');
  expect(g.powers.some((power) => power.kind === 'recall')).toBe(true);
  expect(g.players.right.powerCooldowns.recall).toBeGreaterThan(0);
  expect(g.powers).toHaveLength(1);
  const cash = g.players.right.cash;
  g.status = 'waiting';
  botAct(g, 'right');
  expect(g.players.right.cash).toBe(cash);
});
it('recupera herói adquirido quando há Hospital, dinheiro e população', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 2000;
  p.heroes = [createHeroRecord('che', 3, 'dead')];
  p.buildings.push({
    kind: 'hospital',
    slot: 2,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  });
  botAct(g, 'left');
  expect(p.heroRevivals[0]).toMatchObject({ hero: 'che', slot: 2 });
  expect(p.heroes[0].status).toBe('reviving');
});
it('reserva recuperação mesmo com população cheia para não perder a vaga para fábricas automáticas', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 2000;
  p.workers = 12;
  p.heroes = [createHeroRecord('che', 3, 'dead')];
  p.buildings.push(
    {
      kind: 'housing',
      slot: 1,
      level: 1,
      progress: 0,
      constructionProgress: 0.1,
      completedCycles: 0,
    },
    {
      kind: 'hospital',
      slot: 2,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    },
  );
  botAct(g, 'left');
  expect(p.heroRevivals[0]).toMatchObject({ hero: 'che', populationReserved: false });
});
