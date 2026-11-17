import {money} from '../politics';

export function impactTone(value:number) {
  return value>0 ? 'gain' : value<0 ? 'loss' : 'neutral';
}

export function formatImpact(value:number,currency=false) {
  const sign = value>0 ? '+' : value<0 ? '−' : '';
  return sign+(currency ? money(Math.abs(value)) : String(Math.abs(value)));
}
