import {advertisements,type Advertisement,type CampaignBroadcast} from '../src/elections';
import {canActOnFire,fireSites} from '../src/fire';
import {hasInventorySpace,occupiesInventorySlot,type GameplayAction,type GameplayView} from '../src/gameplay';
import {canStand,type Motion,type Player} from '../src/map';
import {marketProduct} from '../src/market-catalog';
import {npcs} from '../src/npcs';
import {canReachStation,stations,type PlenaryView} from '../src/plenary';
import {canOperatePanel,powerPanels} from '../src/power';
import type {GameplayWorld} from './gameplay-world';
import type {PlenaryMatch} from './PlenaryMatch';

type Tactic = 'landMine'|'incendiary'|'power'|'campaign';
type Plan = {kind:Tactic;until:number;point:Motion;advertisement?:Advertisement};

export class BotTactics {
  private next:number;
  private plan?:Plan;
  private last?:Tactic;
  private plantingUntil = 0;
  private escapeUntil = 0;
  constructor(private random:()=>number,now:number) { this.next = now+20_000+random()*40_000; }

  tick(player:Player,view:PlenaryView,game:GameplayView,match:PlenaryMatch,world:GameplayWorld,
    go:(point:Motion)=>void,rest:()=>void,act:(action:GameplayAction)=>void,broadcast:(ad:CampaignBroadcast)=>void) {
    const {now} = world;
    if (now<this.escapeUntil) { go(stations.audit); return true; }
    if (now<this.plantingUntil) { rest(); return true; }
    if (this.plan && now>=this.plan.until) this.finish(now);
    if (!this.plan) {
      if (now<this.next) return false;
      this.next = now+25_000+this.random()*45_000;
      const wallet = view.politics?.wallet ?? 0;
      const choices:Tactic[] = [];
      if (view.election?.canCampaign && !view.election.personal?.advertised && wallet>=advertisements.spot.cost) choices.push('campaign');
      if (view.role==='Infiltrado') {
        if (view.canSabotagePower) choices.push('power');
        for (const kind of ['landMine','incendiary'] as const) {
          const price = marketProduct('equipment',kind,world.policies,world.publicBudget)?.price;
          if (game.inventory.some(item=>item.kind===kind) || price!==undefined && wallet>=price && hasInventorySpace(game.inventory.filter(occupiesInventorySlot).length)) choices.push(kind);
        }
      }
      const varied = choices.filter(kind=>kind!==this.last);
      const options = varied.length ? varied : choices;
      if (!options.length || this.random()>=.7) return false;
      const kind = options[Math.floor(this.random()*options.length)];
      const targets = kind==='incendiary' ? fireSites : [stations.archive,stations.library,stations.coffee];
      let point:Motion = kind==='power' ? powerPanels[0] : kind==='campaign' ? stations.press : targets[Math.floor(this.random()*targets.length)];
      if (kind==='incendiary') {
        const site = fireSites.indexOf(point as typeof fireSites[number]);
        const approaches = [-16,0,16].flatMap(dx=>[-16,0,16].map(dy=>({x:point.x+dx,y:point.y+dy})));
        const approach = approaches.find(p=>canStand(p.x,p.y) && canActOnFire({...player,...p},site));
        if (!approach) return false;
        point = approach;
      }
      const affordable = (Object.keys(advertisements) as Advertisement[]).filter(key=>advertisements[key].cost<=wallet);
      this.plan = {kind,point,until:now+30_000,advertisement:affordable[Math.floor(this.random()*affordable.length)]};
    }
    const plan = this.plan;
    if (plan.kind==='campaign') {
      if (!view.election?.canCampaign || view.election.personal?.advertised) { this.finish(now); return false; }
      if (!canReachStation(player,'press')) go(plan.point);
      else {
        rest();
        const ad = match.electionAction(player,{kind:'advertise',advertisement:plan.advertisement},now,false);
        if (ad) broadcast({...ad,advertiserId:player.id});
        this.finish(now);
      }
    } else if (plan.kind==='power') {
      if (!view.canSabotagePower) { this.finish(now); return false; }
      if (!canOperatePanel(player,0)) go(plan.point);
      else { rest(); match.actOnPower(player,{kind:'sabotage',panel:0},now); this.finish(now); }
    } else {
      const item = game.inventory.find(item=>item.kind===plan.kind);
      if (!item) {
        const price = marketProduct('equipment',plan.kind,world.policies,world.publicBudget)?.price;
        if (price===undefined || (view.politics?.wallet ?? 0)<price || !hasInventorySpace(game.inventory.filter(occupiesInventorySlot).length)) { this.finish(now); return false; }
        if (game.dialogue?.npc==='vendor' && game.dialogue.shop) { rest(); act({kind:'shop-buy',target:plan.kind,token:game.dialogue.token}); }
        else if (game.npcNearby?.includes('vendor')) { rest(); act({kind:'open-shop',target:'vendor'}); }
        else go({x:npcs.vendor.x,y:npcs.vendor.y+11});
      } else if (game.dialogue) { rest(); act({kind:'dialogue-close'}); }
      else if (Math.hypot(player.x-plan.point.x,player.y-plan.point.y)>3) go(plan.point);
      else {
        rest();
        if (plan.kind==='landMine') {
          if (!game.npcNearby?.length) act({kind:'plant-mine',item:item.id});
          // Leave the arming area immediately; the owner can also trigger a mine.
          this.escapeUntil = now+5000;
          go(stations.audit);
        } else {
          const interaction = match.fireInteraction(player,now,Infinity,true,false);
          if (interaction?.option?.kind==='plant' && match.actOnFire(player,'plant',interaction.option.site,now,false,item.id)) this.plantingUntil = now+4000;
        }
        this.finish(now);
      }
    }
    return true;
  }
  private finish(now:number) {
    this.last = this.plan?.kind;
    this.plan = undefined;
    this.next = now+35_000+this.random()*55_000;
  }
}
