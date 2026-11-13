import type { Player } from '../map';
import { MAX_STAMINA } from '../movement';
import type { PlenaryView } from '../plenary';
import { missionTitle, type Mission } from '../politics';

type Congress = {stability:number;budget:number};
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
  const broadcast = channel(false);
  const congress = channel<Congress>({stability:48,budget:32});
  const agenda = channel<Agenda|undefined>(undefined);
  const profile = channel<Profile|undefined>(undefined);
  const stamina = channel<Stamina>({current:MAX_STAMINA,max:MAX_STAMINA});
  const resources = channel<PersonalResources|undefined>(undefined);
  let matchId:number|undefined;
  return {
    broadcast,congress,agenda,profile,stamina,resources,
    player(player:Pick<Player,'stamina'|'staminaMax'>) {
      const max = player.staminaMax ?? MAX_STAMINA;
      stamina.update({current:Math.floor(player.stamina ?? max),max});
    },
    render(view:PlenaryView) {
      congress.update({stability:view.stability,budget:view.budget});
      const progress = view.phase==='lobby' ? undefined : view.politics?.progression;
      const previous = matchId===progress?.matchId ? agenda.get() : undefined;
      matchId = progress?.matchId;
      resources.update(progress && view.politics ? {wallet:view.politics.wallet,popularity:view.politics.popularity} : undefined);
      profile.update(progress && {hp:view.gameplay?.vitality?.hp,maxHp:view.gameplay?.vitality?.max,
        xp:progress.xp,start:progress.levelStart,next:progress.nextLevelXp,level:progress.level});
      const missions = view.phase==='lobby' ? undefined : view.politics?.missions;
      if (!missions) { agenda.update(undefined); return; }
      const recent = missions.completed.slice(-2);
      const fresh = previous ? recent.filter(mission=>!previous.recent.some(done=>done.id===mission.id)) : [];
      agenda.update({active:missions.active,recent,announcement:fresh.length
        ? fresh.map(mission=>'Concluído: '+missionTitle(mission)).join('. ') : previous?.announcement ?? ''});
    },
  };
}

export type HudModel = ReturnType<typeof createHudModel>;
