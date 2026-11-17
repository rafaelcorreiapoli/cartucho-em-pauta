import {HudHelpButton} from './hud-help';
import {HudIcon} from './hud-icon';
import {CharacterPortrait} from './character-portrait';
import {fireRules,fireSites,type FireView} from '../fire';
import {powerPanels} from '../power';
import {settingsApp} from '../hud-apps';
import { stabilityRules, publicDebtRules, publicDebtStabilityLoss } from '../plenary';
import { createRoot } from 'react-dom/client';
import { useSyncExternalStore, type ReactNode } from 'react';
import { createHudModel, type HudModel } from './hud-model';
import { missionReward, missionTitle, money, timedAgendas, type Mission } from '../politics';
import './theme.css';

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

function Parliament({state,countdown}:{state:HudModel['congress'];countdown:HudModel['countdown']}) {
  const values = useSyncExternalStore(state.subscribe,state.get);
  return <><ParliamentMetrics {...values}/><PlenaryCountdown state={countdown}/></>;
}

function PlenaryCountdown({state}:{state:HudModel['countdown']}) {
  const remaining = useSyncExternalStore(state.subscribe,state.get);
  if (remaining===undefined) return null;
  return <div className="plenary-countdown" data-kind={remaining.kind}><HudIcon name="clock"/>{remaining.kind==='cassation' ? 'Votação de cassação' : 'Votação de projeto'} em <strong>{remaining.seconds} s</strong></div>;
}

export function ParliamentMetrics({stability,budget,sessionRemaining,debtPenaltyIn}:ReturnType<HudModel['congress']['get']>) {
  return <section className="congress-meter grid text-center" aria-label="Parlamento">
    <div className="congress-emblem" aria-hidden="true">
      <svg viewBox="0 0 96 30">
        <path fill="currentColor" d="M2 16h26v3h-2v8h4v2H0v-2h4v-8H2zm6 3v8h3v-8zm6 0v8h3v-8zm6 0v8h3v-8zM68 16h26v3h-2v8h4v2H66v-2h4v-8h-2zm6 3v8h3v-8zm6 0v8h3v-8zm6 0v8h3v-8zM47 1h2v9l13 4v3h-3v10h4v2H33v-2h4V17h-3v-3l13-4zm-6 16v10h3V17zm6 0v10h3V17zm6 0v10h3V17z"/>
      </svg>
    </div>
    <HudHelpButton className="congress-meter-label" aria-label="Como funciona a estabilidade"
      help={`Projetos e decisões afetam a estabilidade. A meta da sessão é ${stabilityRules.target}. A zero, o Parlamento entra em colapso.`}>Estabilidade institucional</HudHelpButton>
    <div className="congress-meter-track flex items-center">
      <Laurel/>
      <Meter label="Estabilidade institucional" value={stability} max={stabilityRules.maximum} tone={stability<stabilityRules.target ? 'danger' : 'stability'} target={stabilityRules.target}/>
      <strong className="tabular-nums">{stability}</strong>
      <Laurel right/>
    </div>
    <HudHelpButton className="congress-budget flex items-center justify-center"
      data-in-debt={budget<0}
      help={`Projetos e despesas obrigatórias podem gerar dívida. A cada ${publicDebtRules.interval/1000} s, cada R$ 10 mil de dívida ou fração custa 1 ponto de estabilidade, até ${publicDebtRules.maximumLoss}. Depósitos na Tesouraria abatem a dívida.`}>
      <span>Orçamento Público</span><strong className="tabular-nums">{budget<0 ? `−${money(-budget)}` : money(budget)}</strong>
    </HudHelpButton>
    {debtPenaltyIn!==undefined && <div className="congress-debt" role="timer" aria-label="Próxima perda de estabilidade por dívida">
      <HudIcon name="alert"/><span>Dívida</span><strong>−{publicDebtStabilityLoss(budget)} de estabilidade em {debtPenaltyIn} s</strong>
    </div>}
    {sessionRemaining!==undefined && <div className="congress-session-clock" role="timer"
      aria-label="Tempo restante da sessão" data-urgent={sessionRemaining<=60}>
      <HudIcon name="clock"/><span>Fim da sessão</span>
      <strong className="tabular-nums">{Math.floor(sessionRemaining/60)}:{String(sessionRemaining%60).padStart(2,'0')}</strong>
    </div>}
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
  const reward = missionReward(mission.kind);
  const timed = timedAgendas.has(mission.kind);
  const current = timed ? Math.floor(mission.current/1000) : mission.current;
  const target = timed ? mission.target/1000 : mission.target;
  const progress = (mission.kind==='fortuna' || mission.kind==='poupancaInstitucional' || mission.kind==='investimentoPolitico' || mission.kind==='ostentacao' || mission.kind==='reservaCofre' || mission.kind==='contribuinte') ? money(current)+' / '+money(target) :
    target>1 ? current+' / '+target+(timed ? ' s' : '') : '';
  return <li className="flex items-start gap-2" data-done={done}>
    <span className="react-mission-check" aria-hidden="true">{done && <HudIcon name="check"/>}</span>
    <div className="min-w-0 flex-1">
      <strong>{missionTitle(mission)}</strong>
      <div className="react-mission-meta">
        <div className="react-mission-rewards" role="group" aria-label="Prêmios da missão">
          <span data-reward="xp">{reward.xp} XP</span>
          {!!reward.cash && <span data-reward="cash"><HudIcon name="wallet"/>{money(reward.cash)}</span>}
          {!!reward.popularity && <span data-reward="popularity"><HudIcon name="chart"/>+{reward.popularity} Pop<span className="sr-only">ularidade</span></span>}
        </div>
        {!done && progress && <small>{progress}</small>}
      </div>
    </div>
  </li>;
}

function Vitals({profile,stamina}:{profile:HudModel['profile']; stamina:HudModel['stamina']}) {
  const stats = useSyncExternalStore(profile.subscribe,profile.get,profile.get);
  const energy = useSyncExternalStore(stamina.subscribe,stamina.get,stamina.get);
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
  const resources = useSyncExternalStore(state.subscribe,state.get,state.get);
  if (!resources) return null;
  return <div className="profile-resource-row">
    <span title="Popularidade"><HudIcon name="chart"/>Pop. <strong>{resources.popularity}</strong></span>
    <span title="Dinheiro na carteira"><HudIcon name="wallet"/><strong>{money(resources.wallet)}</strong></span>
  </div>;
}

function Level({state}:{state:HudModel['profile']}) {
  const profile = useSyncExternalStore(state.subscribe,state.get,state.get);
  return profile && <strong className="react-level tabular-nums" aria-label={`Nível ${profile.level}`}>NV {profile.level}</strong>;
}

export function CharacterProfile({model}:{model:HudModel}) {
  const person = useSyncExternalStore(model.character.subscribe,model.character.get,model.character.get);
  const {former,infiltrator,office} = useSyncExternalStore(model.mandate.subscribe,model.mandate.get,model.mandate.get);
  return <>
    <div className="profile-portrait">
      {person ? <CharacterPortrait id="hud-portrait" character={person.character}/> : null}
      <ProfileReward state={model.profileReward}/>
    </div>
    <div className="deck-identity">
      <div className="profile-name-row">
        <strong id="hud-nick">{person?.nick}</strong>
        {infiltrator ? <HudHelpButton id="profile-role" className="resource-help profile-help" aria-label="Infiltrado"
          help="Infiltrado. Derrube a estabilidade."><HudIcon name="bug"/></HudHelpButton> : null}
        <span id="profile-level-mount"><Level state={model.profile}/></span>
      </div>
      <div className="profile-subtitle">
        <small id="hud-office">{former ? 'Ex-parlamentar' : 'Parlamentar'}</small>
        {office ? <small id="own-office">Gabinete {office.padStart(2,'0')}</small> : null}
      </div>
      <div id="profile-resources"><ProfileResources state={model.resources}/></div>
    </div>
    <div id="profile-vitals"><Vitals profile={model.profile} stamina={model.stamina}/></div>
  </>;
}

function ProfileReward({state}:{state:HudModel['profileReward']}) {
  const reward = useSyncExternalStore(state.subscribe,state.get,state.get);
  return <div id="profile-xp-reward" role="status">{reward}</div>;
}

function Broadcast({state}:{state:HudModel['broadcast']}) {
  const active = useSyncExternalStore(state.subscribe,state.get);
  return active && <div className="react-broadcast rounded-hud bg-hud-surface text-hud-ink" role="status">📣 Transmissão por Megafone</div>;
}

export function FireNotice({fire}:{fire:FireView}) {
  return <aside id="active-fire" className="incident-panel" aria-labelledby="fire-title" data-paused={fire.paused}>
    <article className="incident-fire">
      <svg className="hud-glyph incident-flame" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 22a7 7 0 0 0 7-7c0-3-2-5-3-6 0 2-1 3-2 3 1-4-1-8-4-10 0 4-1 6-3 8a7 7 0 0 0 5 12Z"/>
        <path d="M12 22a3 3 0 0 0 3-3c0-2-2-3-3-5-1 2-3 3-3 5a3 3 0 0 0 3 3Z"/>
      </svg>
      <div><strong id="fire-title">Incêndio</strong><small>{fireSites[fire.site].name}</small></div>
      <span className="incident-time">{fire.paused ? 'Pausado' : `${fire.remaining} s`}</span>
      {!fire.paused && <p><HudIcon name="shield"/>−{fire.damage} de estabilidade a cada {fireRules.tick/1000} s</p>}
    </article>
  </aside>;
}

function PowerNotice({state}:{state:HudModel['outage']}) {
  const outage = useSyncExternalStore(state.subscribe,state.get);
  if (!outage) return null;
  const status = outage.paused ? 'Reparo pausado' : outage.seconds ? `Restabelecendo energia · ${outage.seconds} s` :
    outage.operating!==undefined ? 'Aguardando o outro painel. Permaneça no alcance.' : 'Dois jogadores devem operar os painéis juntos.';
  return <aside id="active-outage" className="incident-panel" aria-labelledby="outage-title" data-paused={outage.paused}>
    <article className="incident-fire">
      <HudIcon name="alert"/>
      <div><strong id="outage-title">Pane elétrica</strong>
        {powerPanels.map(({name},index)=><small key={name}>{index===0 ? 'A' : 'B'} · {name} · {outage.occupied[index] ? 'Em uso' : 'Livre'}</small>)}
      </div>
      <p>{status}</p>
    </article>
  </aside>;
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

export function PlenarySettingsButton({open}:{open:()=>void}) {
  const {label,key,icon} = settingsApp;
  return <button id="plenary-settings" className="hud-icon-button" type="button" tabIndex={-1}
    aria-label={label} aria-keyshortcuts={key} title={label+' ('+key+')'} onClick={open}>
    <HudIcon name={icon}/>
  </button>;
}

export function mountReactHud(openSettings:()=>void) {
  const model = createHudModel();
  const {broadcast,congress,agenda} = model;
  const televisionRoot = createRoot(document.getElementById('electoral-notice-mount')!);
  televisionRoot.render(<LiveTelevision state={model.television}/>);
  const fireRoot = createRoot(document.getElementById('active-fire-mount')!);
  fireRoot.render(<ActiveFire state={model.fire}/>);
  const outageRoot = createRoot(document.getElementById('active-outage-mount')!);
  outageRoot.render(<PowerNotice state={model.outage}/>);
  const broadcastRoot = createRoot(document.getElementById('megaphone-status')!);
  broadcastRoot.render(<Broadcast state={broadcast}/>);
  const profileRoot = createRoot(document.getElementById('profile-dock')!);
  profileRoot.render(<CharacterProfile model={model}/>);
  const parliamentRoot = createRoot(document.getElementById('congress-dock')!);
  const agendaRoot = createRoot(document.getElementById('agenda-dock')!);
  parliamentRoot.render(<><Parliament state={congress} countdown={model.countdown}/><PlenarySettingsButton open={openSettings}/></>);
  agendaRoot.render(<AgendaPanel state={agenda}/>);
  return {
    broadcast: broadcast.update,
    player: model.player,
    profileReward:model.profileReward.update,
    render: model.render,
    destroy() { televisionRoot.unmount(); fireRoot.unmount(); outageRoot.unmount(); broadcastRoot.unmount(); parliamentRoot.unmount(); agendaRoot.unmount(); profileRoot.unmount(); },
  };
}
