import { setCharacterPortrait } from './character-art';
import { officeKeys, offices, type ElectionView } from './elections';
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
