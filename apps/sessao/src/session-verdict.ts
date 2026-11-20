import type {PlenaryView} from './plenary';

export function sessionVerdict({winner,role,congressDestroyed}:Pick<PlenaryView,'winner'|'role'|'congressDestroyed'>) {
  if (!role) return undefined;
  if (!winner) return congressDestroyed ? 'defeat' : undefined;
  return winner===role ? 'victory' : 'defeat';
}
