import type {GameplayView} from '../gameplay';
import {infirmary} from '../medical';

export function treatmentAction(offer:GameplayView['treatment']) {
  if (!offer) return;
  const title = offer.target ? 'Atender jogador carregado' : 'Consultar '+infirmary.doctor.name;
  return {label:`${title} · Grátis`};
}
