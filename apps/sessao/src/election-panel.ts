import { setCharacterPortrait } from './character-art';
import { ELECTION_RULES, type ElectionAction } from './elections';
import type { Player } from './map';
import { stations, STATION_RADIUS, type PlenaryView } from './plenary';
import { money } from './politics';

const el = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const actionButtons = ['advertise','speech','interview','object'] as const;

export function createElectionPanel(id:string, send:(action:ElectionAction) => void, hasVoice:()=>boolean) {
  const dock = el<HTMLDetailsElement>('election-dock');
  const notice = el('electoral-notice');
  const investment = el<HTMLInputElement>('investment');
  const endorsement = el<HTMLSelectElement>('endorsement');
  let view:PlenaryView | undefined;
  let own:Player | undefined;
  let lastResult = 0;
  let pollsKey = '';
  let candidatesKey = '';
  dock.hidden = notice.hidden = true;
  dock.open = false;
  const campaign = el<HTMLDialogElement>('campaign-dialog');
  const openCampaign = el<HTMLButtonElement>('election-actions');
  openCampaign.onclick = () => campaign.showModal();
  el('close-campaign').onclick = () => campaign.close();
  investment.value = '1';
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
    el('station-election-actions').hidden = !election?.canCampaign || !personal;
    el('interview-hint').hidden = true;
    if (!election?.canCampaign || !personal) return;
    const at = (key:keyof typeof stations) => !!own && Math.hypot(own.x-stations[key].x,own.y-stations[key].y)<=STATION_RADIUS;
    el<HTMLButtonElement>('advertise').disabled = !at('press') || personal.advertised ||
      (view?.politics?.wallet ?? 0)<ELECTION_RULES.advertisementCost;
    el<HTMLButtonElement>('speech').disabled = !at('panel') || personal.spoke;
    el<HTMLButtonElement>('interview').disabled = !at('tv') || !election.canInterview || !hasVoice();
    el('interview-hint').hidden = !at('tv') || !election.canInterview || hasVoice();
    el('object').hidden = false;
    el<HTMLButtonElement>('object').disabled = !at('panel') || !election.canObject;
  }

  return {
    render(next:PlenaryView) {
      view = next;
      const election = view.election, personal = election?.personal;
      dock.hidden = !election;
      openCampaign.hidden = !election?.canCampaign;
      if (openCampaign.hidden && campaign.open) campaign.close();
      if (!election) return;
      const {remaining,broadcast,result} = election;
      const race = election.polls;
      const rank = race?.findIndex(candidate => candidate.id===id) ?? -1;
      const candidate = rank>=0 ? race?.[rank] : undefined;
      el('current-office').textContent = 'Renovação de Mandato';
      el('election-position').textContent = candidate ? `${rank+1}º · ${candidate.estimate}%${rank===race.length-1 && race.length>ELECTION_RULES.minimumMandates ? ' · Em risco' : ''}${candidate.trend ? ` · ${candidate.trend>0 ? '+' : ''}${candidate.trend} pp` : ''}` : '';
      dock.dataset.urgency = view.phase==='finished' ? '' : remaining<=30 ? 'high' : remaining<=60 ? 'soon' : '';
      const timer = el('election-timer');
      timer.textContent = `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
      timer.parentElement!.hidden = view.phase==='finished' || remaining===0;
      el('election-wallet').textContent = personal ? money(personal.invested) : '—';
      el('election-result').hidden = !result;
      el('election-result-title').textContent = result ? `Renovação ${result.cycle}` : 'Última renovação';
      el('election-result-detail').textContent = result ?
        (result.eliminated ? `${result.offices.find(person=>person.id===result.eliminated)?.name} perdeu o mandato. ` : '')+
        (result.expectedSalary ? `Salário: ${money(result.salary)} de ${money(result.expectedSalary)} (${Math.round(result.salary/result.expectedSalary*100)}%).` : '') : '';
      if (result && result.cycle!==lastResult) {
        lastResult = result.cycle;
        if (!campaign.open) dock.open = false;
      }
      if (broadcast) {
        notice.hidden = false;
        const label = `TV ao vivo: ${broadcast.name} · ${broadcast.remaining}s`;
        if (notice.textContent!==label) notice.textContent = label;
      } else if (notice.textContent?.startsWith('TV ao vivo:')) {
        notice.hidden = true;
        notice.textContent = '';
      }
      if (personal) {
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
        const section = document.createElement('section');
        const heading = document.createElement('h4');
        heading.textContent = 'Classificação projetada';
        const list = document.createElement('ol');
        list.setAttribute('role','list');
        const candidates = election.polls;
        for (const [index,candidate] of candidates.entries()) {
          const row = document.createElement('li');
          const trend = candidate.trend ? `${candidate.trend>0 ? '+' : ''}${candidate.trend} pp` : '';
          const label = document.createElement('div');
          label.className = 'poll-label';
          const person = document.createElement('span');
          person.textContent = candidate.name+(candidate.id===id ? ' (você)' : '');
          const estimate = document.createElement('strong');
          estimate.textContent = `${candidate.estimate}%`;
          estimate.dataset.effect = candidate.trend>0 ? 'gain' : candidate.trend<0 ? 'loss' : 'neutral';
          label.append(person,estimate);
          if (trend) {
            const movement = document.createElement('small');
            movement.textContent = trend;
            movement.dataset.effect = estimate.dataset.effect;
            estimate.after(movement);
          }
          const meter = document.createElement('progress');
          meter.max = 100;
          meter.value = candidate.estimate;
          meter.setAttribute('aria-label',`Intenção de voto de ${candidate.name}`);
          const card = document.createElement('div');
          card.className = 'poll-card';
          const avatar = document.createElement('span');
          avatar.className = 'poll-avatar';
          const portrait = document.createElement('span');
          portrait.className = 'portrait';
          portrait.setAttribute('aria-hidden','true');
          setCharacterPortrait(portrait,candidate.character);
          const details = document.createElement('div');
          details.className = 'poll-details';
          details.append(label,meter);
          const rank = document.createElement('span');
          rank.className = 'poll-rank';
          rank.dataset.rank = String(index+1);
          rank.textContent = `${index+1}º`;
          avatar.append(portrait,rank);
          card.append(avatar,details);
          row.append(card);
          if (candidate.supports) {
            const support = document.createElement('small');
            support.textContent = `Apoia ${name(candidate.supports)}`;
            details.append(support);
          }
          list.append(row);
        }
        section.append(heading,list);
        el('election-polls').replaceChildren(section);
      }
      controls();
    },
    players(players:Player[]) {
      own = players.find(player => player.id===id);
      controls();
    },

  };
}
