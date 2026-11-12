import { expect, it } from 'vitest';
import {
  createGame,
  execute,
  step,
  spawnUnit,
  isGlobalPowerUnlocked,
  globalPowerQuote,
  globalPowerUnlockRequirements,
  unlockGlobalPowers,
} from './index';
function bankGame() {
  const game = createGame(),
    p = game.players.left;
  p.buildings = [
    { kind: 'bank', slot: 1, level: 1, progress: 0, constructionProgress: 1, completedCycles: 0 },
  ];
  p.workers = 10;
  p.popularity = 100;
  spawnUnit(game, 'right', 'front');
  return game;
}
it('rejeita requisitos incompletos e fraude no comando sem cobrar ou iniciar recarga', () => {
  const g = createGame(),
    p = g.players.left;
  p.popularity = 200;
  spawnUnit(g, 'right', 'front');
  expect(
    execute(g, 'left', { type: 'power', kind: 'bills', unlockedPowers: ['bills'], cost: 0 }),
  ).toMatch(/Requer/);
  expect(p.popularity).toBe(200);
  expect(p.powerCooldowns.bills).toBe(0);
  expect(isGlobalPowerUnlocked(p, 'bills')).toBe(false);
});
it('obra não desbloqueia e prédio concluído libera mesmo sem renda ou popularidade', () => {
  const g = bankGame(),
    p = g.players.left;
  p.buildings[0].constructionProgress = 0.5;
  unlockGlobalPowers(p);
  expect(isGlobalPowerUnlocked(p, 'bills')).toBe(false);
  p.buildings[0].constructionProgress = 1;
  p.workers = 0;
  p.popularity = -100;
  step(g, 0.05);
  expect(isGlobalPowerUnlocked(p, 'bills')).toBe(true);
});
it('desbloqueio é permanente e cada uso debita somente o custo do dono', () => {
  const g = bankGame(),
    p = g.players.left;
  unlockGlobalPowers(p);
  p.buildings = [];
  p.workers = 0;
  expect(execute(g, 'left', { type: 'power', kind: 'bills' })).toBeNull();
  expect(p.popularity).toBe(40);
  expect(g.players.right.popularity).toBe(0);
  expect(isGlobalPowerUnlocked(p, 'bills')).toBe(true);
  expect(execute(g, 'left', { type: 'power', kind: 'bills' })).toMatch(/recarregando/);
  expect(p.popularity).toBe(40);
});
it('todos os prédios são exigidos e desconto afeta somente o custo', () => {
  const g = bankGame(),
    p = g.players.left;
  p.buildings[0].kind = 'academy';
  p.popularity = 99;
  p.research = ['spell_threshold', 'spell_threshold', 'spell_threshold'];
  unlockGlobalPowers(p);
  expect(isGlobalPowerUnlocked(p, 'strength')).toBe(false);
  expect(globalPowerUnlockRequirements(p, 'strength').some((r) => !r.met)).toBe(true);
  p.buildings.push({ ...p.buildings[0], kind: 'hospital', slot: 2 });
  unlockGlobalPowers(p);
  p.popularity = 53;
  spawnUnit(g, 'left', 'front', 1, true);
  expect(globalPowerQuote(p, 'strength').cost).toBe(53);
  expect(execute(g, 'left', { type: 'power', kind: 'strength' })).toBeNull();
  expect(p.popularity).toBe(0);
});
it('falta de alvo não consome popularidade nem inicia cooldown', () => {
  const g = bankGame(),
    p = g.players.left;
  g.units = [];
  expect(execute(g, 'left', { type: 'power', kind: 'bills' })).toMatch(/Nenhuma unidade/);
  expect(p.popularity).toBe(100);
  expect(p.powerCooldowns.bills).toBe(0);
});
