import {fireRules,fireSites,type FireView} from '../fire';
import { stabilityRules } from '../plenary';
import { createRoot } from 'react-dom/client';
import { useSyncExternalStore, type ReactNode } from 'react';
import { createHudModel, type HudModel } from './hud-model';
import { missionTitle, money, timedAgendas, type Mission } from '../politics';
import './theme.css';

function Icon({name}:{name:string}) {
  return <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+name}/></svg>;
}

function Meter({label,value,max,tone,target}:{label:string;value:number;max:number;tone:string;target?:number}) {
  const fraction = Math.max(0,Math.min(1,value/max));
  return <div className="react-meter" data-tone={tone} role="progressbar" aria-label={label}
    aria-valuemin={0} aria-valuemax={max} aria-valuenow={fraction*max} aria-valuetext={String(value)}>
    <span style={{transform:'scaleX('+fraction+')'}}/>
    {target!==undefined && <i style={{left:(100*target/max)+'%'}}/>}
  </div>;
}

function Laurel({right=false}:{right?:boolean}) {
  return <svg className={`congress-laurel${right ? ' congress-laurel-right' : ''}`} viewBox="0 0 30 68" aria-hidden="true">
    <path d="M26 65C5 51 1 26 18 5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    <path fill="currentColor" d="M16 13Q15 6 24 2Q24 9 16 13ZM12 22Q11 15 19 11Q20 18 12 22ZM9 31Q9 24 16 20Q18 28 9 31ZM10 40Q10 32 17 29Q19 36 10 40ZM13 49Q13 41 20 38Q22 46 13 49ZM18 57Q17 50 24 47Q26 53 18 57ZM11 22Q3 19 5 12Q12 15 11 22ZM8 32Q0 28 1 21Q9 24 8 32ZM9 42Q1 40 1 32Q9 34 9 42ZM13 51Q5 51 3 43Q11 43 13 51ZM19 60Q11 61 7 53Q15 53 19 60Z"/>
  </svg>;
}

function Parliament({state}:{state:HudModel['congress']}) {
  const values = useSyncExternalStore(state.subscribe,state.get);
  return <ParliamentMetrics {...values}/>;
}

export function ParliamentMetrics({stability,budget}:ReturnType<HudModel['congress']['get']>) {
  return <section className="congress-meter grid text-center" aria-label="Parlamento">
    <div className="congress-emblem" aria-hidden="true">
      <svg viewBox="0 0 96 30">
        <path fill="currentColor" d="M2 16h26v3h-2v8h4v2H0v-2h4v-8H2zm6 3v8h3v-8zm6 0v8h3v-8zm6 0v8h3v-8zM68 16h26v3h-2v8h4v2H66v-2h4v-8h-2zm6 3v8h3v-8zm6 0v8h3v-8zm6 0v8h3v-8zM47 1h2v9l13 4v3h-3v10h4v2H33v-2h4V17h-3v-3l13-4zm-6 16v10h3V17zm6 0v10h3V17zm6 0v10h3V17z"/>
      </svg>
    </div>
    <button type="button" className="congress-meter-label" aria-label="Como funciona a estabilidade"
      data-help={`Projetos e decisões afetam a estabilidade. A meta da sessão é ${stabilityRules.target}. A zero, o Parlamento entra em colapso.`}>Estabilidade institucional</button>
    <div className="congress-meter-track flex items-center">
      <Laurel/>
      <Meter label="Estabilidade institucional" value={stability} max={stabilityRules.maximum} tone={stability<stabilityRules.target ? 'danger' : 'stability'} target={stabilityRules.target}/>
      <strong className="tabular-nums">{stability}</strong>
      <Laurel right/>
    </div>
    <button type="button" className="congress-budget flex items-center justify-center"
      data-help={`Paga projetos e verbas de gabinete. Cada ponto de déficit custa ${stabilityRules.deficitRate} pontos de estabilidade.`}>
      <span>Orçamento Público</span><strong className="tabular-nums">{money(budget)}</strong>
    </button>
  </section>;
}

function HudPanel({children}:{children:ReactNode}) {
  return <aside className="react-agenda grid gap-3"
    aria-labelledby="agenda-title">{children}</aside>;
}

function AgendaPanel({state}:{state:HudModel['agenda']}) {
  const agenda = useSyncExternalStore(state.subscribe,state.get);
  if (!agenda) return null;
  return <HudPanel>
    <header className="flex items-center gap-3">
      <svg className="hud-glyph agenda-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3M8 11h1m3 0h4m-8 4h1m3 0h4"/>
        <path d="M9 7V5a3 3 0 0 1 6 0v2Z"/>
      </svg>
      <h2 id="agenda-title">Agenda Pessoal</h2>
    </header>
    {agenda.recent.length>0 && <ul className="react-missions completed" aria-label="Conclusões recentes">
      {agenda.recent.map(mission=><MissionRow key={mission.id} mission={mission} done/>)}
    </ul>}
    <ul className="react-missions" aria-label="Objetivos ativos">
      {agenda.active.map(mission=><MissionRow key={mission.id} mission={mission}/>)}
    </ul>
    <span className="sr-only" role="status">{agenda.announcement}</span>
  </HudPanel>;
}

export function MissionRow({mission,done=false}:{mission:Mission;done?:boolean}) {
  const timed = timedAgendas.has(mission.kind);
  const current = timed ? Math.floor(mission.current/1000) : mission.current;
  const target = timed ? mission.target/1000 : mission.target;
  const progress = (mission.kind==='fortuna' || mission.kind==='ostentacao') ? money(current)+' / '+money(target) :
    target>1 ? current+' / '+target+(timed ? ' s' : '') : '';
  return <li className="flex items-start gap-2" data-done={done}>
    <span className="react-mission-check" aria-hidden="true">{done && <Icon name="check"/>}</span>
    <div className="min-w-0 flex-1">
      <strong>{missionTitle(mission)}</strong>
      {!done && progress && <small>{progress}</small>}
    </div>
  </li>;
}

function Vitals({profile,stamina}:{profile:HudModel['profile']; stamina:HudModel['stamina']}) {
  const stats = useSyncExternalStore(profile.subscribe,profile.get);
  const energy = useSyncExternalStore(stamina.subscribe,stamina.get);
  if (!stats) return null;
  const earned = stats.xp-stats.start;
  const goal = stats.next===undefined ? 0 : stats.next-stats.start;
  return <div className="react-vitals grid gap-1.5">
    {stats.hp!==undefined && stats.maxHp!==undefined &&
      <div className="vital-row" data-tone="health"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 3.6 13A5.6 5.6 0 0 1 12 5.8 5.6 5.6 0 0 1 20.4 13Z"/></svg>
        <Meter label="PV" value={stats.hp} max={stats.maxHp} tone="health"/>
        <small>{stats.hp} / {stats.maxHp}</small>
      </div>}
    <div className="vital-row" data-tone="stamina"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-9 12h7l-2 8 11-13h-8l3-7Z"/></svg>
      <Meter label="Stamina" value={energy.current} max={energy.max} tone="stamina"/>
      <small>{energy.current} / {energy.max}</small>
    </div>
    <div className="vital-row" data-tone="xp"><span aria-hidden="true">XP</span>
      <Meter label="XP" value={goal ? earned : 1} max={goal || 1} tone="xp"/>
      <small>{goal ? `${earned} / ${goal}` : 'MAX'}</small>
    </div>
  </div>;
}

function ProfileResources({state}:{state:HudModel['resources']}) {
  const resources = useSyncExternalStore(state.subscribe,state.get);
  if (!resources) return null;
  return <div className="profile-resource-row">
    <span title="Popularidade"><Icon name="chart"/>Pop. <strong>{resources.popularity}</strong></span>
    <span title="Dinheiro na carteira"><Icon name="wallet"/><strong>{money(resources.wallet)}</strong></span>
  </div>;
}

function Level({state}:{state:HudModel['profile']}) {
  const profile = useSyncExternalStore(state.subscribe,state.get);
  return profile && <strong className="react-level tabular-nums" aria-label={`Nível ${profile.level}`}>NV {profile.level}</strong>;
}

function Broadcast({state}:{state:HudModel['broadcast']}) {
  const active = useSyncExternalStore(state.subscribe,state.get);
  return active && <div className="react-broadcast rounded-hud bg-hud-surface text-hud-ink" role="status">📣 Transmissão por Megafone</div>;
}

export function FireNotice({fire}:{fire:FireView}) {
  return <p id="active-fire" className="hud-feedback" aria-live="off">
    <span aria-hidden="true">🔥 </span>{fireSites[fire.site].name} · {fire.remaining} s · {
      fire.paused ? 'Pausado' : `−${fire.damage} de estabilidade a cada ${fireRules.tick/1000} s`
    }
  </p>;
}

function ActiveFire({state}:{state:HudModel['fire']}) {
  const fire = useSyncExternalStore(state.subscribe,state.get);
  return fire && <FireNotice fire={fire}/>;
}

export function TelevisionNotice({name,remaining}:{name:string;remaining:number}) {
  return <aside id="electoral-notice" className="hud-strip" role="status">
    TV ao vivo: {name} · {remaining}s
  </aside>;
}

function LiveTelevision({state}:{state:HudModel['television']}) {
  const interview = useSyncExternalStore(state.subscribe,state.get);
  return interview && <TelevisionNotice {...interview}/>;
}

export function mountReactHud() {
  const model = createHudModel();
  const {broadcast,congress,agenda,profile,stamina,resources} = model;
  const televisionRoot = createRoot(document.getElementById('electoral-notice-mount')!);
  televisionRoot.render(<LiveTelevision state={model.television}/>);
  const fireRoot = createRoot(document.getElementById('active-fire-mount')!);
  fireRoot.render(<ActiveFire state={model.fire}/>);
  const broadcastRoot = createRoot(document.getElementById('megaphone-status')!);
  broadcastRoot.render(<Broadcast state={broadcast}/>);
  const vitalsRoot = createRoot(document.getElementById('profile-vitals')!);
  const resourcesRoot = createRoot(document.getElementById('profile-resources')!);
  resourcesRoot.render(<ProfileResources state={resources}/>);
  const levelRoot = createRoot(document.getElementById('profile-level-mount')!);
  vitalsRoot.render(<Vitals profile={profile} stamina={stamina}/>);
  levelRoot.render(<Level state={profile}/>);
  const parliamentRoot = createRoot(document.getElementById('congress-dock')!);
  const agendaRoot = createRoot(document.getElementById('agenda-dock')!);
  parliamentRoot.render(<Parliament state={congress}/>);
  agendaRoot.render(<AgendaPanel state={agenda}/>);
  return {
    broadcast: broadcast.update,
    player: model.player,
    render: model.render,
    destroy() { televisionRoot.unmount(); fireRoot.unmount(); broadcastRoot.unmount(); parliamentRoot.unmount(); agendaRoot.unmount(); vitalsRoot.unmount(); levelRoot.unmount(); resourcesRoot.unmount(); },
  };
}
