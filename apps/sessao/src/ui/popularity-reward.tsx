import {HudIcon} from './hud-icon';

export function PopularityReward({amount}:{amount:number}) {
  return <span data-reward="popularity"><HudIcon name="chart"/>+{amount} Pop<span className="sr-only">ularidade</span></span>;
}
