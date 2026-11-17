import {bills, pingaProgram, projectRules, type PlenaryView} from '../plenary';
import {money} from '../politics';

const signed = (value:number) => value>0 ? `+${value}` : String(value);

export function ProjectCatalog({project,outcomes,projectFilingClosed}:Pick<PlenaryView,'project'|'outcomes'|'projectFilingClosed'>) {
  const voted = new Map(outcomes.map(outcome=>[outcome.project,outcome]));
  return <section aria-label="Catálogo de projetos" className="grid gap-3">
    <p><strong>{outcomes.length}/{projectRules.requiredVotes} projetos votados.</strong> {projectFilingClosed ? 'Protocolo de projetos encerrado.' : 'Solicite um documento na Secretaria e leve ao Protocolo.'}</p>
    {bills.map((bill,index)=>{
      const result = voted.get(index);
      const effect = bill.effect;
      return <details key={bill.id}>
        <summary><strong>{bill.name}</strong> · {result ? (result.passed ? 'Votado: aprovado' : 'Votado: rejeitado') : project===index ? 'Em pauta' : projectFilingClosed ? 'Fora do prazo' : 'Disponível'}</summary>
        <p>{bill.description}</p>
        <p>Aprovar: {signed(bill.yes.stability)} de estabilidade · {effect?.kind==='allowance' ? `${money(effect.perMandate)} por mandato` :
          effect?.kind==='pinga-distribution' ? pingaProgram.detail : `${signed(Math.min(0,bill.yes.budget))} de orçamento`}</p>
        {effect?.kind==='policy' && <p>{effect.detail}.</p>}
        <p>Rejeitar: {signed(bill.no.stability)} de estabilidade · {signed(Math.min(0,bill.no.budget))} de orçamento</p>
      </details>;
    })}
  </section>;
}
