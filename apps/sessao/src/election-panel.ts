import { ELECTION_RULES, officeKeys, offices, type ElectionAction, type Office } from './elections';
import type { Player } from './map';
import { stations, STATION_RADIUS, type PlenaryView } from './plenary';
import { money } from './politics';

const el = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const actionButtons = ['advertise','speech','interview','object'] as const;

export function createElectionPanel(id:string, send:(action:ElectionAction) => void, hasVoice:()=>boolean) {
  const dock = el<HTMLDetailsElement>('election-dock');
  const notice = el('electoral-notice');
  const registration = el<HTMLSelectElement>('election-race');
  const investment = el<HTMLInputElement>('investment');
  const endorsement = el<HTMLSelectElement>('endorsement');
  let view:PlenaryView | undefined;
  let own:Player | undefined;
  let lastResult = 0;
  let lastRace:Office | undefined;
  let pollsKey = '';
  let candidatesKey = '';
  dock.hidden = notice.hidden = true;
  dock.open = false;
  el<HTMLDetailsElement>('election-actions').open = false;
  investment.value = '1';
  el<HTMLFormElement>('registration').onsubmit = event => {
    event.preventDefault();
    if (officeKeys.includes(registration.value as Office)) send({kind:'run',office:registration.value as Office});
  };
  el<HTMLFormElement>('invest-form').onsubmit = event => {
    event.preventDefault();
    if (investment.reportValidity()) send({kind:'invest',amount:investment.valueAsNumber});
  };
  el<HTMLFormElement>('support-form').onsubmit = event => {
    event.preventDefault();
    send({kind:'support',to:endorsement.value});
  };
  for (const kind of actionButtons) el<HTMLButtonElement>(kind).onclick = () => send({kind});

  function controls() {
    const election = view?.election;
    const personal = election?.personal;
    if (!election || !personal) return;
    const at = (key:keyof typeof stations) => !!own && Math.hypot(own.x-stations[key].x,own.y-stations[key].y)<=STATION_RADIUS;
    el<HTMLButtonElement>('advertise').disabled = !at('press') || personal.advertised ||
      (view?.politics?.wallet ?? 0)<ELECTION_RULES.advertisementCost;
    el<HTMLButtonElement>('speech').disabled = !at('panel') || personal.spoke;
    el<HTMLButtonElement>('interview').disabled = !at('tv') || !election.canInterview || !hasVoice();
    el('interview-hint').hidden = !at('tv') || hasVoice();
    el('object').hidden = personal.office!=='president';
    el<HTMLButtonElement>('object').disabled = !at('panel') || !election.canObject;
  }

  return {
    render(next:PlenaryView) {
      view = next;
      const election = view.election, personal = election?.personal;
      dock.hidden = !election;
      if (!election) return;
      const {remaining,broadcast,result} = election;
      const race = personal && election.polls.filter(candidate => candidate.race===personal.race);
      const rank = race?.findIndex(candidate => candidate.id===id) ?? -1;
      const candidate = rank>=0 ? race?.[rank] : undefined;
      el('current-office').textContent = personal ? `Disputa · ${offices[personal.race].name}` : 'Eleições';
      el('election-position').textContent = candidate ? `${rank+1}º · ${candidate.estimate}%${candidate.trend ? ` · ${candidate.trend>0 ? '+' : ''}${candidate.trend} pp` : ''}` : '';
      dock.dataset.urgency = view.phase==='finished' ? '' : remaining<=30 ? 'high' : remaining<=60 ? 'soon' : '';
      el('election-timer').textContent = view.phase==='finished' ? 'Eleições' : `Eleição em ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
      el('office-display').textContent = personal ? offices[personal.office].name : 'Assessor';
      el('office-display').dataset.office = personal?.office ?? 'advisor';
      el('office-power').dataset.help = personal ? offices[personal.office].power : 'Você pode acompanhar a pesquisa como assessor.';
      el('office-salary').textContent = personal ? money(personal.salary) : '—';
      el('election-wallet').textContent = personal ? money(personal.invested) : '—';
      el('election-result').hidden = !result;
      el('election-result-title').textContent = result ? `Resultado · Eleição ${result.cycle}` : 'Última eleição';
      el('election-result-detail').textContent = result ? [
        `Eleição ${result.cycle}: ${result.offices.map(person => `${person.name} (${offices[person.office].name})`).join(', ')}.`,
        result.previous && personal ? `Seu cargo: ${offices[result.previous].name} → ${offices[personal.office].name}. Salário recebido: ${money(result.salary)}.` : '',
      ].join(' ') : '';
      if (result && result.cycle!==lastResult) {
        lastResult = result.cycle;
        dock.open = false;
      }
      if (broadcast) {
        notice.hidden = false;
        const label = `TV ao vivo: ${broadcast.name} · ${broadcast.remaining}s`;
        if (notice.textContent!==label) notice.textContent = label;
      } else if (notice.textContent?.startsWith('TV ao vivo:')) {
        notice.hidden = true;
        notice.textContent = '';
      }
      el('election-actions').hidden = !election.canCampaign;
      if (personal) {
        if (personal.race!==lastRace) registration.value = lastRace = personal.race;
        registration.disabled = !election.registrationOpen;
        el<HTMLButtonElement>('register-race').disabled = registration.disabled;
        el('registration-hint').textContent = election.registrationOpen ? '' : 'Candidaturas encerradas.';
        investment.max = String(Math.min(view.politics?.wallet ?? 0,ELECTION_RULES.investmentCap-personal.invested));
        el<HTMLButtonElement>('invest').disabled = Number(investment.max)<1;
      }
      const candidates = election.offices.filter(candidate => candidate.id!==id);
      const key = candidates.map(({id,name}) => id+name).join('|');
      if (key!==candidatesKey) {
        candidatesKey = key;
        const previous = endorsement.value;
        endorsement.replaceChildren(new Option('Sem apoio',''),...candidates.map(person => new Option(person.name,person.id)));
        if (candidates.some(person => person.id===previous)) endorsement.value = previous;
      }
      const nextPollsKey = JSON.stringify(election.polls);
      if (pollsKey!==nextPollsKey) {
        pollsKey = nextPollsKey;
        const name = (id:string) => election.offices.find(person => person.id===id)?.name;
        const emptyRaces = document.createElement('div');
        emptyRaces.className = 'empty-races';
        const sections:HTMLElement[] = [];
        for (const office of officeKeys) {
          const section = document.createElement('section');
          const heading = document.createElement('h4');
          heading.textContent = offices[office].name;
          heading.dataset.office = office;
          const list = document.createElement('ol');
          list.dataset.office = office;
          for (const candidate of election.polls.filter(candidate => candidate.race===office)) {
            const row = document.createElement('li');
            const trend = candidate.trend>0 ? ` · +${candidate.trend} pp` : candidate.trend<0 ? ` · ${candidate.trend} pp` : '';
            const label = document.createElement('div');
            label.className = 'poll-label';
            const person = document.createElement('span');
            person.textContent = candidate.name+(candidate.id===id ? ' (você)' : '');
            const estimate = document.createElement('strong');
            estimate.textContent = `${candidate.estimate}%${trend}`;
            estimate.dataset.effect = candidate.trend>0 ? 'gain' : candidate.trend<0 ? 'loss' : 'neutral';
            label.append(person,estimate);
            const meter = document.createElement('progress');
            meter.max = 100;
            meter.value = candidate.estimate;
            meter.setAttribute('aria-label',`Intenção de voto de ${candidate.name}`);
            row.append(label,meter);
            if (candidate.supports) {
              const support = document.createElement('small');
              support.textContent = `Apoia ${name(candidate.supports)}`;
              row.append(support);
            }
            list.append(row);
          }
          if (list.children.length) {
            section.append(heading,list);
            sections.push(section);
          } else {
            const empty = document.createElement('span');
            empty.textContent = `${offices[office].name} · sem candidatos`;
            emptyRaces.append(empty);
          }
        }
        if (emptyRaces.children.length) sections.push(emptyRaces);
        el('election-polls').replaceChildren(...sections);
      }
      controls();
    },
    players(players:Player[]) {
      own = players.find(player => player.id===id);
      controls();
    },

  };
}
