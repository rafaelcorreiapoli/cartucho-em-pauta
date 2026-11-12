import { setCharacterPortrait } from './character-art';
import { officeKeys, offices, type ElectionView } from './elections';
import { bills, type Outcome, type PlenaryView } from './plenary';

function node<K extends keyof HTMLElementTagNameMap>(tag:K, text:string) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function electionResult(result:NonNullable<ElectionView['result']>) {
  const section = document.createElement('section');
  section.append(node('h3',`Resultado da eleição ${result.cycle}`));
  for (const office of officeKeys) {
    const winners = result.offices.filter(person => person.office===office);
    section.append(node('h4',offices[office].name));
    if (!winners.length) section.append(node('p','Sem eleitos'));
    for (const winner of winners) {
      const row = document.createElement('div');
      row.className = 'result-winner';
      const portrait = node('span','');
      portrait.className = 'portrait';
      portrait.setAttribute('aria-hidden','true');
      setCharacterPortrait(portrait,winner.character);
      const name = node('span',winner.name);
      if (winner.race!==winner.office) name.append(node('small',`Votos na disputa de ${offices[winner.race].name}`));
      row.append(portrait,name,node('strong',`${winner.percentage}%`));
      section.append(row);
    }
  }
  return section;
}

function projectResult(outcome:Outcome) {
  const section = document.createElement('section');
  const tally = document.createElement('div');
  tally.className = 'project-result-tally';
  for (const [label,value] of [['A favor',outcome.yes],['Contra',outcome.no]] as const) {
    const cell = node('span','');
    cell.append(node('strong',String(value)),node('small',label));
    tally.append(cell);
  }
  const signed = (amount:number) => amount>0 ? '+'+amount : String(amount);
  section.append(node('h3',bills[outcome.round].name),node('h4',outcome.passed ? 'Projeto aprovado' : 'Projeto rejeitado'),tally,
    node('p',`Estabilidade ${signed(outcome.applied.stability)} · Orçamento ${signed(outcome.applied.budget)}`));
  return section;
}

export function showNewResults(view:PlenaryView, previous:PlenaryView | undefined) {
  const election = view.election?.result;
  const electionChanged = election && election.cycle!==previous?.election?.result?.cycle;
  const project = view.outcome;
  const projectChanged = project && project.round!==previous?.outcome?.round;
  if (!electionChanged && !projectChanged) return;

  const dialog = document.querySelector<HTMLDialogElement>('#result-dialog')!;
  const content = document.querySelector('#result-content')!;
  if (!dialog.open) content.replaceChildren();
  if (projectChanged) content.append(projectResult(project));
  if (electionChanged) content.append(electionResult(election));
  document.querySelector<HTMLDialogElement>('#campaign-dialog')?.close();
  if (!dialog.open) dialog.showModal();
}
