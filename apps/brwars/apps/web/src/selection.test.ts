import { BUILDINGS, createGame, execute, spawnUnit, step } from '@brwars/simulation';
import { describe, expect, it } from 'vitest';
import {
  controlGroupMembers,
  nextFreePlot,
  resolveSelection,
  selectionCommand,
  type MapSelection,
} from './selection';

describe('seleção contextual do mapa', () => {
  it('não escolhe um terreno nem oferece construção sem seleção', () => {
    const game = createGame();
    expect(resolveSelection(game, null)).toEqual({ kind: 'empty' });
    for (const key of ['m', 'r', 'e', 'r', 'j', 'l'])
      expect(selectionCommand(game, 'left', null, key)).toBeNull();
  });
  it('constrói no terreno clicado e passa a oferecer melhoria após a construção', () => {
    const game = createGame();
    const selection = { kind: 'plot', side: 'left', slot: 2 } as const;
    const command = selectionCommand(game, 'left', selection, 'r');
    expect(command).toEqual({ type: 'build', kind: 'media', slot: 2 });
    expect(execute(game, 'left', command)).toBeNull();
    expect(resolveSelection(game, selection)).toMatchObject({
      kind: 'plot',
      slot: 2,
      building: { kind: 'media' },
    });
    expect(selectionCommand(game, 'left', selection, 'r')).toBeNull();
    expect(selectionCommand(game, 'left', selection, 'l')).toBeNull();
    for (let i = 0; i < BUILDINGS.media.constructionTime * 20; i++) step(game, 0.05);
    expect(selectionCommand(game, 'left', selection, 'l')).toEqual({ type: 'upgrade', slot: 2 });
  });
  it('permite inspecionar o inimigo sem oferecer ações sobre ele', () => {
    const game = createGame();
    const selection = { kind: 'plot', side: 'right', slot: 0 } as const;
    expect(resolveSelection(game, selection)).toMatchObject({
      side: 'right',
      building: { kind: 'barracks' },
    });
    expect(selectionCommand(game, 'left', selection, 'l')).toBeNull();
    expect(
      selectionCommand(game, 'left', { kind: 'plot', side: 'right', slot: 1 }, 'm'),
    ).toBeNull();
  });
  it('mostra dados da unidade e limpa o contexto quando ela deixa de existir', () => {
    const game = createGame();
    spawnUnit(game, 'left', 'ranged');
    const selection = { kind: 'unit', id: game.units[0].id } as const;
    expect(resolveSelection(game, selection)).toMatchObject({
      kind: 'unit',
      unit: { kind: 'ranged', hp: 65 },
    });
    expect(selectionCommand(game, 'left', selection, 'm')).toBeNull();
    game.units = [];
    expect(resolveSelection(game, selection)).toEqual({ kind: 'empty' });
  });
  it('reserva recrutamento para a base aliada selecionada', () => {
    const game = createGame();
    expect(selectionCommand(game, 'left', { kind: 'base', side: 'left' }, 'r')).toEqual({
      type: 'worker',
    });
    expect(selectionCommand(game, 'left', { kind: 'base', side: 'left' }, 'j')).toEqual({
      type: 'hero',
    });
    expect(selectionCommand(game, 'left', { kind: 'base', side: 'right' }, 'r')).toBeNull();
    expect(selectionCommand(game, 'left', { kind: 'plot', side: 'left', slot: 1 }, 'c')).toEqual({
      type: 'build',
      kind: 'civic',
      slot: 1,
    });
  });
});

it('inspeciona trabalhadores existentes sem oferecer comandos militares', () => {
  const game = createGame();
  expect(resolveSelection(game, { kind: 'worker', side: 'left', index: 0 })).toEqual({
    kind: 'worker',
    side: 'left',
    index: 0,
  });
  expect(resolveSelection(game, { kind: 'worker', side: 'left', index: 99 })).toEqual({
    kind: 'empty',
  });
  expect(
    selectionCommand(game, 'left', { kind: 'worker', side: 'left', index: 0 }, 'r'),
  ).toBeNull();
});

it('O constrói moradia no terreno e C constrói a feira cultural', () => {
  const game = createGame(),
    selection = { kind: 'plot' as const, side: 'left' as const, slot: 1 };
  expect(selectionCommand(game, 'left', selection, 'o')).toEqual({
    type: 'build',
    kind: 'housing',
    slot: 1,
  });
  expect(selectionCommand(game, 'left', selection, 'c')).toEqual({
    type: 'build',
    kind: 'civic',
    slot: 1,
  });
});

it('atalhos de Banco e faculdade correspondem ao catálogo', () => {
  const game = createGame(),
    selection = { kind: 'plot' as const, side: 'left' as const, slot: 1 };
  expect(selectionCommand(game, 'left', selection, 'b')).toEqual({
    type: 'build',
    kind: 'bank',
    slot: 1,
  });
  expect(selectionCommand(game, 'left', selection, 'u')).toBeNull();
  game.players.left.buildings.push({
    kind: 'civic',
    slot: 2,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  });
  expect(selectionCommand(game, 'left', selection, 'u')).toBeNull();
  expect(selectionCommand(game, 'left', selection, 'e')).toEqual({
    type: 'build',
    kind: 'school',
    slot: 1,
  });
  expect(selectionCommand(game, 'left', selection, 'h')).toBeNull();
  game.players.left.buildings.push({
    kind: 'school',
    slot: 3,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  });
  expect(selectionCommand(game, 'left', selection, 'h')).toEqual({
    type: 'build',
    kind: 'hospital',
    slot: 1,
  });
  expect(selectionCommand(game, 'left', selection, 'u')).toEqual({
    type: 'build',
    kind: 'academy',
    slot: 1,
  });
});

it('terreno não adquirido oferece compra e bloqueia atalhos de construção até adquirir', () => {
  const game = createGame(),
    selection = { kind: 'plot', side: 'left', slot: 47 } as const;
  expect(selectionCommand(game, 'left', selection, 'm')).toBeNull();
  expect(selectionCommand(game, 'left', selection, 'a')).toEqual({ type: 'buy-plot', slot: 47 });
  execute(game, 'left', { type: 'buy-plot', slot: 47 });
  expect(selectionCommand(game, 'left', selection, 'm')).toEqual({
    type: 'build',
    kind: 'barracks',
    slot: 47,
  });
});

it('P alterna a produção automática usando o estado atual da construção selecionada', () => {
  const game = createGame(),
    selection = { kind: 'plot', side: 'left', slot: 0 } as const;
  const pause = selectionCommand(game, 'left', selection, 'p');
  expect(pause).toEqual({ type: 'auto-production', slot: 0, paused: true });
  expect(execute(game, 'left', pause)).toBeNull();
  expect(selectionCommand(game, 'left', selection, 'p')).toEqual({
    type: 'auto-production',
    slot: 0,
    paused: false,
  });
  game.players.left.buildings[0].constructionProgress = 0.5;
  expect(selectionCommand(game, 'left', selection, 'p')).toBeNull();
  game.players.left.buildings[0].constructionProgress = 1;
  game.players.left.buildings[0].kind = 'bank';
  expect(selectionCommand(game, 'left', selection, 'p')).toBeNull();
});
it('D demole inclusive obras e universidades, mas não terrenos vazios, bases ou inimigos', () => {
  const game = createGame(),
    selection = { kind: 'plot', side: 'left', slot: 0 } as const;
  game.players.left.buildings[0].kind = 'academy';
  game.players.left.buildings[0].constructionProgress = 0.2;
  const command = selectionCommand(game, 'left', selection, 'd');
  expect(command).toEqual({ type: 'demolish', slot: 0 });
  expect(execute(game, 'left', command)).toBeNull();
  expect(selectionCommand(game, 'left', selection, 'd')).toBeNull();
  for (const key of ['p', 'd']) {
    expect(
      selectionCommand(game, 'left', { kind: 'plot', side: 'right', slot: 0 }, key),
    ).toBeNull();
    expect(selectionCommand(game, 'left', { kind: 'base', side: 'left' }, key)).toBeNull();
    expect(selectionCommand(game, 'left', null, key)).toBeNull();
  }
});

it('mantém múltiplos membros aliados no grupo e descarta unidades mortas ou inimigas', () => {
  const game = createGame();
  spawnUnit(game, 'left', 'front');
  spawnUnit(game, 'left', 'ranged');
  spawnUnit(game, 'right', 'front');
  const [front, ranged, enemy] = game.units;
  const group: MapSelection[] = [
    { kind: 'unit', id: front.id },
    { kind: 'unit', id: ranged.id },
    { kind: 'unit', id: enemy.id },
    { kind: 'worker', side: 'left', index: 0 },
    { kind: 'plot', side: 'left', slot: 0 },
    { kind: 'plot', side: 'left', slot: 2 },
  ];
  const saved = controlGroupMembers(game, 'left', group);
  expect(saved).toEqual([group[0], group[1], group[3], group[4]]);

  ranged.hp = 0;
  game.players.left.workers = 0;
  game.players.left.buildings = [];
  expect(controlGroupMembers(game, 'left', saved)).toEqual([group[0]]);
});

it('percorre os lotes livres aliados, incluindo os que ainda estão à venda, e volta ao primeiro', () => {
  const game = createGame();
  expect(nextFreePlot(game, 'left', null)?.slot).toBe(1);
  expect(nextFreePlot(game, 'left', { kind: 'plot', side: 'left', slot: 5 })?.slot).toBe(6);
  expect(nextFreePlot(game, 'left', { kind: 'plot', side: 'left', slot: 47 })?.slot).toBe(1);
  expect(nextFreePlot(game, 'left', { kind: 'plot', side: 'right', slot: 5 })?.slot).toBe(1);
  expect(nextFreePlot(game, 'left', { kind: 'plot', side: 'left', slot: 6 }, true)?.slot).toBe(5);
  expect(nextFreePlot(game, 'left', { kind: 'plot', side: 'left', slot: 1 }, true)?.slot).toBe(47);
});
