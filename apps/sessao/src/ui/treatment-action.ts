import type {GameplayView} from '../gameplay';
import {infirmary} from '../medical';
import {money} from '../politics';

export function treatmentAction(offer:GameplayView['treatment'],wallet?:number) {
  if (!offer) return;
  const price = offer.price ?? infirmary.price;
  const affordable = offer.affordable ?? (wallet===undefined || wallet>=price);
  const title = offer.target ? 'Atender carregado' : 'Consultar '+infirmary.doctor.name;
  return {label:`${title} · ${money(price)}`,disabled:!affordable};
}
