import type {FireView} from '../fire';
import type {PowerView} from '../power';
import type { Player } from '../map';
import { MAX_STAMINA } from '../movement';
import { stabilityRules, type PlenaryView, type PayrollView } from '../plenary';
import { ELECTION_RULES } from '../elections';
import { missionTitle, type Mission } from '../politics';

type Congress = {gameMode?:import('../game-modes').GameMode;caloteIn?:number;stability:number;budget:number;sessionRemaining?:number;debtPenaltyIn?:number;payroll?:PayrollView['next']};
type Agenda = {active:Mission[]; recent:Mission[]; announcement:string};
type Profile = {hp?:number; maxHp?:number; xp:number; start:number; next?:number; level:number};
type Stamina = {current:number; max:number};
type PersonalResources = {wallet:number; popularity:number};

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

export function createHudModel() {
  const automaticProjects = channel<{state:NonNullable<PlenaryView['automaticProjects']>;matchId?:number}|undefined>(undefined);
  const ghostAdvisers = channel<import('../ghost-advisers').GhostAdviserIncident|undefined>(undefined);
  const fires = channel<FireView[]|undefined>(undefined);
  const outage = channel<PowerView|undefined>(undefined);
  const broadcast = channel(false);
  const television = channel<{name:string;remaining:number}|undefined>(undefined);
  const congress = channel<Congress>({stability:stabilityRules.initial,budget:ELECTION_RULES.startingBudget});
  const countdown = channel<{kind:'bill'|'cassation';seconds:number}|undefined>(undefined);
  const agenda = channel<Agenda|undefined>(undefined);
  const profile = channel<Profile|undefined>(undefined);
  const character = channel<Pick<Player,'nick'|'character'>|undefined>(undefined);
  const mandate = channel<{former:boolean;infiltrator:boolean;office?:string}>({former:false,infiltrator:false});
  const profileReward = channel('');
  const stamina = channel<Stamina>({current:MAX_STAMINA,max:MAX_STAMINA});
  const resources = channel<PersonalResources|undefined>(undefined);
  let matchId:number|undefined;
  return {
    automaticProjects,ghostAdvisers,fires,outage,broadcast,television,congress,countdown,agenda,profile,stamina,resources,character,mandate,profileReward,
    player(player:Pick<Player,'stamina'|'staminaMax'|'nick'|'character'>) {
      const identity = character.get();
      if (identity?.nick!==player.nick || identity?.character!==player.character) {
        character.update({nick:player.nick,character:player.character});
      }
      const max = player.staminaMax ?? MAX_STAMINA;
      stamina.update({current:Math.floor(player.stamina ?? max),max});
    },
    render(view:PlenaryView) {
      broadcast.update(view.phase==='negotiation' && view.megaphoneActive===true);
      automaticProjects.update(view.automaticProjects && view.phase!=='lobby' && view.phase!=='finished' ? {state:view.automaticProjects,matchId:view.politics?.progression.matchId} : undefined);
      fires.update(view.fires);
      ghostAdvisers.update(view.ghostAdvisers);
      outage.update(view.outage);
      const interview = view.phase==='lobby' || view.phase==='finished' ? undefined : view.election?.broadcast;
      television.update(interview && {name:interview.name,remaining:interview.remaining});
      congress.update({gameMode:view.gameMode,caloteIn:view.caloteIn,stability:view.stability,budget:view.budget,sessionRemaining:view.sessionRemaining,debtPenaltyIn:view.debtPenaltyIn,payroll:view.payroll?.next});
      countdown.update(view.phase!=='negotiation' ? undefined : view.cassationIn ?
        {kind:'cassation',seconds:view.cassationIn} : view.projectWarning ?
          {kind:'bill',seconds:view.projectWarning} : undefined);
      const progress = view.phase==='lobby' ? undefined : view.politics?.progression;
      const previous = matchId===progress?.matchId ? agenda.get() : undefined;
      matchId = progress?.matchId;
      mandate.update({former:view.mandate===false,infiltrator:view.role==='Infiltrado',office:view.gameplay?.ownOffice});
      resources.update(progress && view.politics ? {wallet:view.politics.wallet,popularity:view.politics.popularity} : undefined);
      profile.update(progress && {hp:view.gameplay?.vitality?.hp,maxHp:view.gameplay?.vitality?.max,
        xp:progress.xp,start:progress.levelStart,next:progress.nextLevelXp,level:progress.level});
      const missions = view.phase==='lobby' ? undefined : view.politics?.missions;
      if (!missions) { agenda.update(undefined); return; }
      const recent = missions.completed.slice(-1);
      const fresh = previous ? recent.filter(mission=>!previous.recent.some(done=>done.id===mission.id)) : [];
      agenda.update({active:missions.active,recent,announcement:fresh.length
        ? fresh.map(mission=>'Concluído: '+missionTitle(mission)).join('. ') : previous?.announcement ?? ''});
    },
  };
}

export type HudModel = ReturnType<typeof createHudModel>;
