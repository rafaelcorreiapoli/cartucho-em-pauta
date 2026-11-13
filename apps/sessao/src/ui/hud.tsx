import { createRoot } from 'react-dom/client';
import { useSyncExternalStore, type ReactNode } from 'react';
import type { Player } from '../map';
import { MAX_STAMINA } from '../movement';
import type { PlenaryView } from '../plenary';
import { missionTitle, money, timedAgendas, type Mission } from '../politics';
import './theme.css';

function channel<T>(initial:T) {
  let value = initial;
  let key = JSON.stringify(initial);
  const listeners = new Set<()=>void>();
  return {
    get:()=>value,
    subscribe(listener:()=>void) {
      listeners.add(listener);
      return ()=>{ listeners.delete(listener); };
    },
    update(next:T) {
      const nextKey = JSON.stringify(next);
      if (nextKey===key) return;
      key = nextKey;
      value = next;
      for (const listener of listeners) listener();
    },
  };
}

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

type Congress = {stability:number;budget:number};
function Parliament({state}:{state:ReturnType<typeof channel<Congress>>}) {
  const {stability,budget} = useSyncExternalStore(state.subscribe,state.get);
  return <section className="react-parliament flex items-center gap-3" aria-label="Parlamento">
    <Resource icon="shield" label="Estabilidade" value={stability} max={100} tone={stability<45 ? 'danger' : 'stability'} target={45}
      help="Projetos e decisões afetam a estabilidade. A meta da sessão é 45. A zero, o Parlamento entra em colapso."/>
    <Resource icon="wallet" label="Orçamento Público" value={budget} max={Math.max(100,budget)} tone="budget" formatted={money(budget)}
      help="Paga projetos e verbas de gabinete. Cada ponto de déficit custa 2 pontos de estabilidade."/>
  </section>;
}

function Resource({icon,label,help,formatted,...meter}:{icon:string;label:string;help:string;formatted?:string;
  value:number;max:number;tone:string;target?:number}) {
  return <div className="react-resource grid gap-1" data-tone={meter.tone}>
    <div className="flex items-center gap-1.5">
      <button type="button" className="resource-help" aria-label={label} data-help={help}><Icon name={icon}/></button>
      <span>{label}</span><strong className="tabular-nums">{formatted ?? meter.value}</strong>
    </div>
    <Meter label={label} {...meter}/>
  </div>;
}

function HudPanel({children}:{children:ReactNode}) {
  return <aside className="react-agenda bg-hud-surface text-hud-ink rounded-hud grid gap-2.5 p-3"
    aria-labelledby="agenda-title">{children}</aside>;
}

type Agenda = {active:Mission[]; recent:Mission[]; announcement:string};
function AgendaPanel({state}:{state:ReturnType<typeof channel<Agenda|undefined>>}) {
  const agenda = useSyncExternalStore(state.subscribe,state.get);
  if (!agenda) return null;
  return <HudPanel>
    <header className="flex items-center gap-2"><Icon name="document"/><h2 id="agenda-title" className="flex-1">Agenda Pessoal</h2>
      <small>{agenda.active.length} ativas</small>
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
  const progress = mission.kind==='fortuna' ? money(current)+' / '+money(target) :
    target>1 ? current+' / '+target+(timed ? ' s' : '') : '';
  return <li className="flex items-start gap-2" data-done={done}>
    <span className="react-mission-check" aria-hidden="true">{done && <Icon name="check"/>}</span>
    <div className="min-w-0 flex-1">
      <strong>{missionTitle(mission)}</strong>
      {!done && progress && <small>{progress}</small>}
    </div>
  </li>;
}

type Profile = {hp?:number; maxHp?:number; xp:number; start:number; next?:number; level:number};
type Stamina = {current:number; max:number};
function Vitals({profile,stamina}:{profile:ReturnType<typeof channel<Profile|undefined>>; stamina:ReturnType<typeof channel<Stamina>>}) {
  const stats = useSyncExternalStore(profile.subscribe,profile.get);
  const energy = useSyncExternalStore(stamina.subscribe,stamina.get);
  if (!stats) return null;
  const earned = stats.xp-stats.start;
  const goal = stats.next===undefined ? 0 : stats.next-stats.start;
  return <div className="react-vitals grid gap-1">
    {stats.hp!==undefined && stats.maxHp!==undefined &&
      <Meter label="PV" value={stats.hp} max={stats.maxHp} tone="health"/>}
    <Meter label="Stamina" value={energy.current} max={energy.max} tone="stamina"/>
    <div className="react-xp">
      <Meter label="XP" value={goal ? earned : 1} max={goal || 1} tone="xp"/>
      <small>{goal ? `${earned}/${goal} XP` : 'MAX'}</small>
    </div>
  </div>;
}

function Level({state}:{state:ReturnType<typeof channel<Profile|undefined>>}) {
  const profile = useSyncExternalStore(state.subscribe,state.get);
  return profile && <strong className="react-level tabular-nums" aria-label={`Nível ${profile.level}`}>NV {profile.level}</strong>;
}

function Broadcast({state}:{state:ReturnType<typeof channel<boolean>>}) {
  const active = useSyncExternalStore(state.subscribe,state.get);
  return active && <div className="react-broadcast rounded-hud bg-hud-surface text-hud-ink" role="status">📣 Transmissão por Megafone</div>;
}

export function mountReactHud() {
  const broadcast = channel(false);
  const broadcastRoot = createRoot(document.getElementById('megaphone-status')!);
  broadcastRoot.render(<Broadcast state={broadcast}/>);
  const congress = channel<Congress>({stability:48,budget:32});
  const agenda = channel<Agenda|undefined>(undefined);
  const profile = channel<Profile|undefined>(undefined);
  const stamina = channel<Stamina>({current:MAX_STAMINA,max:MAX_STAMINA});
  const vitalsRoot = createRoot(document.getElementById('profile-vitals')!);
  const levelRoot = createRoot(document.getElementById('profile-level-mount')!);
  vitalsRoot.render(<Vitals profile={profile} stamina={stamina}/>);
  levelRoot.render(<Level state={profile}/>);
  const parliamentRoot = createRoot(document.getElementById('congress-dock')!);
  const agendaRoot = createRoot(document.getElementById('agenda-dock')!);
  parliamentRoot.render(<Parliament state={congress}/>);
  agendaRoot.render(<AgendaPanel state={agenda}/>);
  let matchId:number|undefined;
  return {
    broadcast: broadcast.update,
    player(player:Player) {
      const max = player.staminaMax ?? MAX_STAMINA;
      stamina.update({current:Math.floor(player.stamina ?? max),max});
    },
    render(view:PlenaryView) {
      congress.update({stability:view.stability,budget:view.budget});
      const progress = view.phase==='lobby' ? undefined : view.politics?.progression;
      if (matchId!==progress?.matchId) {
        matchId = progress?.matchId;
        agenda.update(undefined);
      }
      profile.update(progress && {hp:view.gameplay?.vitality?.hp,maxHp:view.gameplay?.vitality?.max,
        xp:progress.xp,start:progress.levelStart,next:progress.nextLevelXp,level:progress.level});
      const missions = view.phase==='lobby' ? undefined : view.politics?.missions;
      if (!missions) { agenda.update(undefined); return; }
      const previous = agenda.get();
      const recent = missions.completed.slice(-2);
      const fresh = previous ? recent.filter(mission=>!previous.recent.some(done=>done.id===mission.id)) : [];
      agenda.update({active:missions.active,recent,announcement:fresh.length
        ? fresh.map(mission=>'Concluído: '+missionTitle(mission)).join('. ') : previous?.announcement ?? ''});
    },
    destroy() { broadcastRoot.unmount(); parliamentRoot.unmount(); agendaRoot.unmount(); vitalsRoot.unmount(); levelRoot.unmount(); },
  };
}
