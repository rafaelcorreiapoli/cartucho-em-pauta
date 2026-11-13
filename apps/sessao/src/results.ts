import { setCharacterPortrait } from './character-art';
import { type ElectionView } from './elections';
import type { PlenaryView } from './plenary';

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

function electionResult(result:NonNullable<ElectionView['result']>) {
  const section = document.createElement('section');
  section.append(node('h3',`Renovação de Mandato ${result.cycle}`));
  for (const [index,person] of result.offices.entries()) {
    const row = node('div','');
    row.className = 'result-winner';
    const portrait = node('span','');
    portrait.className = 'portrait';
    setCharacterPortrait(portrait,person.character);
    const lost = person.id===result.eliminated;
    const name = node('span',`${index+1}º · ${person.name}`);
    if (lost) name.append(node('small','Mandato perdido'));
    row.dataset.effect = lost ? 'loss' : 'neutral';
    row.append(portrait,name,node('strong',`${person.percentage}%`));
    section.append(row);
  }
  return section;
}

export function showNewResults(view:PlenaryView, previous:PlenaryView | undefined) {
  const election = view.election?.result;
  const electionChanged = election && election.cycle!==previous?.election?.result?.cycle;
  const project = view.outcome;
  const projectChanged = project && project.round!==previous?.outcome?.round;
  if (electionChanged) {
    const dialog = document.querySelector<HTMLDialogElement>('#result-dialog')!;
    document.querySelector('#result-content')!.replaceChildren(electionResult(election));
    document.querySelector<HTMLDialogElement>('#campaign-dialog')?.close();
    document.querySelector<HTMLDialogElement>('#gameplay-dialog')?.close();
    if (!dialog.open) dialog.showModal();
  }
  return projectChanged ? project.passed ? 'approved' : 'rejected' : electionChanged ? 'election' : undefined;
}
