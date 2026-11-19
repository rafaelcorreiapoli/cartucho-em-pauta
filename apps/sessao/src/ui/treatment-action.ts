import type {GameplayView} from '../gameplay';

export function treatmentAction(offer:GameplayView['treatment']) {
  if (!offer) return;
  const title = offer.target ? 'Atender jogador carregado' : 'Usar maca';
  return {label:`${title} · Grátis`};
}
