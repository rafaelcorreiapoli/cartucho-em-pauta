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
  return <section className="congress-meter grid gap-1.5 text-center" aria-label="Parlamento">
    <div className="congress-meter-label flex items-center justify-center gap-2">
      <button type="button" className="resource-help" aria-label="Como funciona a estabilidade"
        data-help="Projetos e decisões afetam a estabilidade. A meta da sessão é 45. A zero, o Parlamento entra em colapso."><Icon name="ballot"/></button>
      <span>Estabilidade institucional</span>
    </div>
    <div className="congress-meter-track flex items-center gap-2">
      <Meter label="Estabilidade institucional" value={stability} max={100} tone={stability<45 ? 'danger' : 'stability'} target={45}/>
      <strong className="tabular-nums">{stability}</strong>
    </div>
    <div className="congress-budget flex items-center justify-center gap-2">
      <button type="button" className="resource-help" aria-label="Como funciona o orçamento público"
        data-help="Paga projetos e verbas de gabinete. Cada ponto de déficit custa 2 pontos de estabilidade."><Icon name="wallet"/></button>
      <span>Orçamento público</span><strong className="tabular-nums">{money(budget)}</strong>
    </div>
  </section>;
}

function HudPanel({children}:{children:ReactNode}) {
  return <aside className="react-agenda grid gap-3"
    aria-labelledby="agenda-title">{children}</aside>;
}

type Agenda = {active:Mission[]; recent:Mission[]; announcement:string};
function AgendaPanel({state}:{state:ReturnType<typeof channel<Agenda|undefined>>}) {
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

type Profile = {hp?:number; maxHp?:number; xp:number; start:number; next?:number; level:number};
type Stamina = {current:number; max:number};
function Vitals({profile,stamina}:{profile:ReturnType<typeof channel<Profile|undefined>>; stamina:ReturnType<typeof channel<Stamina>>}) {
  const stats = useSyncExternalStore(profile.subscribe,profile.get);
  const energy = useSyncExternalStore(stamina.subscribe,stamina.get);
  if (!stats) return null;
  const earned = stats.xp-stats.start;
  const goal = stats.next===undefined ? 0 : stats.next-stats.start;
  return <div className="react-vitals grid gap-1.5">
    {stats.hp!==undefined && stats.maxHp!==undefined &&
      <div className="vital-row" data-tone="health"><span aria-hidden="true">PV</span>
        <Meter label="PV" value={stats.hp} max={stats.maxHp} tone="health"/>
        <small>{stats.hp}/{stats.maxHp}</small>
      </div>}
    <div className="vital-row" data-tone="stamina"><span aria-hidden="true">ϟ</span>
      <Meter label="Stamina" value={energy.current} max={energy.max} tone="stamina"/>
      <small>{energy.current}/{energy.max}</small>
    </div>
    <div className="vital-row" data-tone="xp"><span aria-hidden="true">XP</span>
      <Meter label="XP" value={goal ? earned : 1} max={goal || 1} tone="xp"/>
      <small>{goal ? `${earned}/${goal}` : 'MAX'}</small>
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
