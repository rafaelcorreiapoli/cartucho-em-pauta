import { createGame, createHeroRecord, execute, step } from '@brwars/simulation';
import { describe, expect, it } from 'vitest';
import { recoveryHospital } from './hero-recovery';
import { resolveSelection, selectionCommand } from './selection';

describe('seleção de herói pelo portrait persistente', () => {
  it('mantém o herói selecionado da morte até voltar do Hospital', () => {
    const game = createGame(),
      player = game.players.left,
      record = createHeroRecord('che', 3, 'dead');
    player.heroes.push(record);
    player.cash = 1000;
    player.buildings.push({
      kind: 'hospital',
      slot: 2,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    });
    const selection = { kind: 'hero', side: 'left', hero: 'che' } as const;
    expect(resolveSelection(game, selection)).toEqual({ kind: 'hero', side: 'left', record });
    expect(selectionCommand(game, 'left', selection, 'd')).toBeNull();
    const hospital = recoveryHospital(player).hospital!;
    expect(
      execute(game, 'left', { type: 'hero-revive', hero: 'che', slot: hospital.slot }),
    ).toBeNull();
    expect(resolveSelection(game, selection)).toMatchObject({
      kind: 'hero',
      record: { status: 'reviving' },
    });
    for (let i = 0; i < 160; i++) step(game, 0.05);
    expect(resolveSelection(game, selection)).toMatchObject({
      kind: 'unit',
      side: 'left',
      unit: { hero: 'che', level: 3 },
    });
  });
  it('não inspeciona uma identidade que ainda não foi adquirida', () => {
    expect(resolveSelection(createGame(), { kind: 'hero', side: 'left', hero: 'che' })).toEqual({
      kind: 'empty',
    });
  });
  it('escolhe um Hospital pronto e livre, respeitando o Hospital explicitamente selecionado', () => {
    const player = createGame().players.left;
    expect(recoveryHospital(player)).toMatchObject({
      hospital: undefined,
      reason: 'Requer Hospital concluído',
    });
    player.buildings.push({
      kind: 'hospital',
      slot: 2,
      level: 1,
      progress: 0,
      constructionProgress: 0.5,
      completedCycles: 0,
    });
    expect(recoveryHospital(player).hospital).toBeUndefined();
    player.buildings[1].constructionProgress = 1;
    player.heroRevivals.push({
      hero: 'che',
      slot: 2,
      progress: 0,
      duration: 8,
      cost: 280,
      populationReserved: true,
    });
    expect(recoveryHospital(player).reason).toBe('Hospitais ocupados');
    player.buildings.push({
      kind: 'hospital',
      slot: 3,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    });
    expect(recoveryHospital(player).hospital?.slot).toBe(3);
    expect(recoveryHospital(player, 2).hospital).toBeUndefined();
  });
});
