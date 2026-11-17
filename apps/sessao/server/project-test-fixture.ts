import type {Player} from '../src/map';
import type {PlenaryMatch} from './PlenaryMatch';

// Starts from the same verified filing event emitted by Gameplay after the document checks.
export function publishProjectFiling(match:PlenaryMatch,player:Player,project=0,at=0) {
  const world = match.gameplayWorld([player],at,()=>false);
  const error = world.projectFilingError?.(player.id,project);
  if (error) throw new Error(error);
  world.publish({type:'filed',actor:player.id,project,at,position:player,witnesses:[]});
}
