import {xray,xrayNeedsRecharge} from '../equipment';
import type {GameplayView} from '../gameplay';
import {money} from '../politics';

export function xrayRechargeAction(state:Pick<GameplayView,'npcNearby'|'equipped'>,wallet?:number) {
  if (!state.npcNearby?.includes('vendor')) return;
  const scanner = state.equipped?.find(item=>item.kind==='xray');
  if (!scanner || !xrayNeedsRecharge(scanner.charges)) return;
  return {
    label:`Recarregar Raio X · ${money(xray.rechargePrice)}`,
    disabled:wallet!==undefined && wallet<xray.rechargePrice,
  };
}
