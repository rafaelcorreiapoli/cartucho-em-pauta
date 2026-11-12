import { setCharacterPortrait } from './character-art';
import { officeKeys, offices, type ElectionView } from './elections';
import { bills, type Outcome, type PlenaryView } from './plenary';

function node<K extends keyof HTMLElementTagNameMap>(tag:K, text:string) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function icon(name:string) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('hud-glyph');
  svg.setAttribute('aria-hidden','true');
  const use = document.createElementNS(svg.namespaceURI,'use');
  use.setAttribute('href','#icon-'+name);
  svg.append(use);
  return svg;
}

function metric(symbol:string, value:string, label:string, effect:string) {
  const cell = node('div','');
  cell.className = 'result-metric';
  cell.dataset.effect = effect;
  cell.append(icon(symbol),node('strong',value),node('small',label));
  return cell;
}

function electionResult(result:NonNullable<ElectionView['result']>) {
  const section = document.createElement('section');
  section.append(node('h3',`Resultado da eleição ${result.cycle}`));
  for (const office of officeKeys) {
    const winners = result.offices.filter(person => person.office===office);
    const heading = node('h4',offices[office].name);
    heading.prepend(icon('ballot'));
    section.append(heading);
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
  tally.append(metric('check',String(outcome.yes),'A favor','gain'),metric('cross',String(outcome.no),'Contra','loss'));
  const verdict = node('h4',outcome.passed ? 'Projeto aprovado' : 'Projeto rejeitado');
  verdict.className = 'project-verdict';
  verdict.dataset.effect = outcome.passed ? 'gain' : 'loss';
  verdict.prepend(icon(outcome.passed ? 'check' : 'cross'));
  const impacts = node('div','');
  impacts.className = 'project-result-impacts';
  for (const [symbol,label,amount] of [
    ['shield','Estabilidade',outcome.applied.stability],['wallet','Orçamento',outcome.applied.budget],
  ] as const) {
    const signed = amount>0 ? '+'+amount : String(amount);
    impacts.append(metric(symbol,signed,label,amount>0 ? 'gain' : amount<0 ? 'loss' : 'neutral'));
  }
  section.append(node('h3',bills[outcome.round].name),verdict,tally,impacts);
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
  return projectChanged ? project.passed ? 'approved' : 'rejected' : 'election';
}
