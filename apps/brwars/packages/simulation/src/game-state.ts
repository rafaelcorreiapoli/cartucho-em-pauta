import { BASE_HP, type Side } from './content';
import { battlefieldLayout, type BattlefieldKind } from './battlefields';
import type { GameState, Player } from './model';

export function createGame(
  status: GameState['status'] = 'playing',
  battlefield: BattlefieldKind = 'campo',
): GameState {
  const layout = battlefieldLayout(battlefield);
  const player = (side: Side): Player => ({
    heroes: [],
    heroRevivals: [],
    heroBirthSerial: 0,
    heroCooldowns: {},
    baseAttackLevel: 1,
    baseAttackCooldown: 0,
    baseAttackUpgrading: false,
    baseAttackUpgradeProgress: 0,
    ownedPlots: layout.plots[side].filter((plot) => plot.owned).map((plot) => plot.slot),
    research: [],
    researchJobs: [],
    trainingQueue: [],
    cash: 600,
    popularity: 0,
    unlockedPowers: [],
    powerCooldowns: { bills: 0, recall: 0, silence: 0, strength: 0, sabotage: 0 },
    workers: 3,
    baseHp: BASE_HP,
    loans: [],
    investments: [],
    taxRate: 10,
    heroCooldown: 0,
    buildings: [
      {
        kind: 'barracks',
        slot: 0,
        level: 1,
        progress: 4,
        constructionProgress: 1,
        completedCycles: 0,
      },
    ],
    kills: 0,
  });
  return {
    battlefield,
    time: 0,
    status,
    winner: null,
    players: { left: player('left'), right: player('right') },
    units: [],
    hits: [],
    powers: [],
    nextId: 1,
    log: [{ id: 0, text: 'Comando estabelecido. Expanda a base e destrua o inimigo.' }],
  };
}
export function addLog(game: GameState, text: string) {
  game.log.unshift({ id: game.nextId++, text });
  game.log.length = Math.min(game.log.length, 6);
}
export function finish(game: GameState, winner: GameState['winner']) {
  game.status = 'finished';
  game.winner = winner;
}
