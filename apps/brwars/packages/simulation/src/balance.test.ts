import { expect, it } from 'vitest';
import {
  createGame,
  createHeroRecord,
  execute,
  globalPowerName,
  heroRevivalQuote,
  spawnUnit,
  unitLevelDamageMultiplier,
  UNITS,
} from './index';
it('nível 15 de tropas concede 70% sobre o nível 1, preservando progressão de herói', () => {
  for (const kind of ['front', 'ranged', 'siege'] as const) {
    const g = createGame();
    for (const player of Object.values(g.players))
      player.unlockedPowers = ['bills', 'recall', 'silence', 'strength'];
    spawnUnit(g, 'left', kind, 15, true);
    expect(g.units[0].maxHp).toBeCloseTo(UNITS[kind].hp * 1.7);
    expect(unitLevelDamageMultiplier(kind, 15)).toBeCloseTo(1.7);
  }
  expect(unitLevelDamageMultiplier('hero', 10)).toBeCloseTo(1.9);
});
it('preço do Hospital depende do nível e não do histórico de mortes', () => {
  const p = createGame().players.left,
    record = createHeroRecord('che', 1, 'dead');
  p.heroes = [record];
  for (const revivals of [0, 1, 10, 100]) {
    record.revivals = revivals;
    expect(heroRevivalQuote(p, 'che').cost).toBe(240);
  }
  record.level = 5;
  expect(heroRevivalQuote(p, 'che').cost).toBe(480);
  record.level = 10;
  expect(heroRevivalQuote(p, 'che').cost).toBe(780);
});
it('recuo é relativo ao progresso individual e nunca ultrapassa o ponto inicial', () => {
  for (const side of ['left', 'right'] as const) {
    const g = createGame();
    for (const player of Object.values(g.players))
      player.unlockedPowers = ['bills', 'recall', 'silence', 'strength'];
    g.players[side].popularity = 200;
    const victimSide = side === 'left' ? 'right' : 'left',
      positions = victimSide === 'left' ? [140, 150, 500, 920] : [860, 850, 500, 80],
      expected = victimSide === 'left' ? [150, 150, 325, 535] : [850, 850, 675, 465];
    for (const x of positions) {
      spawnUnit(g, victimSide, 'front', 1, true);
      g.units.at(-1)!.x = x;
    }
    expect(execute(g, side, { type: 'power', kind: 'recall' })).toBeNull();
    expect(g.units.map((u) => u.x)).toEqual(expected);
  }
  expect(globalPowerName('recall', 'left')).toBe('Recua Fascista Recua!');
  expect(globalPowerName('recall', 'right')).toBe('Volta pra Cuba!');
});
