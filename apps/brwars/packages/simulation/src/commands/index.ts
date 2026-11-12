import { type Side } from '../content';
import { executeFinance } from '../finance';
import { normalizeHeroes } from '../hero-progression';
import type { GameState } from '../model';
import { executeResearch } from '../research';
import { executeBuildingCommand } from './buildings';
import { executePower } from './powers';
import { executeRecruitmentCommand } from './recruitment';

export function execute(game: GameState, side: Side, input: unknown): string | null {
  if (game.status !== 'playing') return 'A partida não está em andamento.';
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Comando inválido.';
  const command = input as Record<string, unknown>,
    p = game.players[side];
  if (!p) return 'Jogador inválido.';
  p.trainingQueue ??= [];
  normalizeHeroes(game, side);
  switch (command.type) {
    case 'demolish':
    case 'buy-plot':
    case 'build':
    case 'upgrade':
    case 'upgrade-batch':
    case 'promote':
    case 'select-production':
    case 'auto-production':
      return executeBuildingCommand(game, side, command);
    case 'worker':
    case 'medic':
    case 'hero':
    case 'hero-revive':
      return executeRecruitmentCommand(game, side, command);
    case 'research':
      return executeResearch(game, side, command);
    case 'loan':
    case 'invest':
    case 'repay':
    case 'redeem':
    case 'tax':
      return executeFinance(game, side, command);
    case 'power':
      return executePower(game, side, command);
    default:
      return 'Comando desconhecido.';
  }
}
