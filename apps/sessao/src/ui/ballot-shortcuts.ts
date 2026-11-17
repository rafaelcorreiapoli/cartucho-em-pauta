import type {BillVote,CassationView} from '../plenary';

export const billVoteKeys = {yes:'Y',no:'R',abstain:'N'} as const satisfies Record<BillVote,string>;

export const projectVoteLabels = {yes:'Votar SIM',no:'Votar NÃO',abstain:'Abster-se'} as const;
export const hearingVoteLabels = {yes:'Afastar',no:'Não afastar'} as const;

export function cassationChoices(state:CassationView,ownId:string) {
  const candidates = state.candidates.filter(person=>person.id!==ownId);
  return {
    candidates:candidates.map((person,index)=>({person,key:index<9 ? String(index+1) : undefined})),
    skipKey:candidates.length<9 ? String(candidates.length+1) : '0',
  };
}
