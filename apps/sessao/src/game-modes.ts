import {ELECTION_RULES} from './elections';

export const gameModes = {
  classic:{label:'Clássico',description:'Proteja a estabilidade institucional até o fim da sessão.'},
  calote:{label:'Calote',description:'Evite 30 segundos seguidos de orçamento negativo.'},
} as const;
export type GameMode = keyof typeof gameModes;
export const caloteRules = {debtMs:30_000,budgetMeterLimit:ELECTION_RULES.startingBudget} as const;
export function isGameMode(value:unknown):value is GameMode {
  return typeof value==='string' && Object.hasOwn(gameModes,value);
}
const currency = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
export const publicBudgetLabel = (budget:number)=>currency.format(budget*10_000);
