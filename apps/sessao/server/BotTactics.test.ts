import {expect,test,spyOn} from 'bun:test';
import {BotTactics} from './BotTactics';
import {Gameplay} from './Gameplay';
import {PlenaryMatch} from './PlenaryMatch';
import {stations} from '../src/plenary';
import type {Player} from '../src/map';
import type {GameplayAction} from '../src/gameplay';

function scenario(role:'Infiltrado'|'Parlamentar',random=()=>0) {
  const player:Player = {id:'bot',nick:'Bot',bot:true,character:0,...stations.press,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>.9);
  const gameplay = new Gameplay();
  gameplay.reset(0,()=>.9,[player]);
  const tactics = new BotTactics(random,0);
  const actions:GameplayAction[] = [];
  const ads:unknown[] = [];
  const step = (now:number)=>{
    const world = match.gameplayWorld([player],now,()=>false);
    const view = {...match.view(player.id,[player.id],now),role};
    return tactics.tick(player,view,gameplay.view(player,world),match,world,
      point=>Object.assign(player,point),()=>{},action=>{actions.push(action);gameplay.act(player,action,world);},ad=>ads.push(ad));
  };
  return {player,match,gameplay,actions,ads,step};
}

test('both roles advertise using the election rules and do not repeat each tick',()=>{
  for (const role of ['Infiltrado','Parlamentar'] as const) {
    const s = scenario(role);
    s.step(20_000);
    expect(s.ads).toHaveLength(1);
    for (let now=21_000;now<60_000;now+=1000) s.step(now);
    expect(s.ads).toHaveLength(1);
  }
});

test('randomness can defer an otherwise affordable campaign',()=>{
  const s = scenario('Parlamentar',()=>.9);
  for (let now=0;now<120_000;now+=1000) s.step(now);
  expect(s.ads).toHaveLength(0);
});

test('infiltrators buy mines and plant them while ordinary politicians do not',()=>{
  for (const role of ['Infiltrado','Parlamentar'] as const) {
    const s = scenario(role);
    // Exhaust this cycle campaign so sabotage becomes the next available choice.
    s.step(20_000);
    s.gameplay.giveTrainingItem(s.player.id,'landMine');
    s.match.actOnPower(s.player,{kind:'sabotage',panel:0},21_000);
    for (let now=55_000;now<85_000;now+=1000) s.step(now);
    expect(s.actions.some(action=>action.kind==='plant-mine')).toBe(role==='Infiltrado');
  }
});

test('infiltrators cut power outside the fixed bill debate window',()=>{
  const s = scenario('Infiltrado');
  s.step(20_000); // Campaign first, then a different tactic.
  const cut = spyOn(s.match,'actOnPower').mockReturnValue('Energia cortada.');
  const world = s.match.gameplayWorld([s.player],55_000,()=>false);
  const view = s.match.view(s.player.id,[s.player.id],55_000);
  const tactics = new BotTactics(()=>0,0);
  tactics.tick(s.player,{...view,role:'Infiltrado',canSabotagePower:true,election:undefined},s.gameplay.view(s.player,world),s.match,world,point=>Object.assign(s.player,point),()=>{},()=>{},()=>{});
  tactics.tick(s.player,{...view,role:'Infiltrado',canSabotagePower:true,election:undefined},s.gameplay.view(s.player,world),s.match,world,()=>{},()=>{},()=>{},()=>{});
  expect(cut).toHaveBeenCalledWith(s.player,{kind:'sabotage',panel:0},55_000);
  cut.mockRestore();
});

test('an infiltrator installs an incendiary and remains still during installation',()=>{
  const player:Player = {id:'bot',nick:'Bot',bot:true,character:0,...stations.press,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>.9);
  const gameplay = new Gameplay();
  gameplay.reset(0,()=>.9,[player]);
  gameplay.giveTrainingItem(player.id,'incendiary');
  const tactics = new BotTactics(()=>0,0);
  let rests = 0;
  for (let now=20_000;now<=26_000;now+=1000) {
    const world = match.gameplayWorld([player],now,()=>false);
    const view = {...match.view(player.id,[player.id],now),role:'Infiltrado' as const,canSabotagePower:false,election:undefined};
    // Keep the device but remove purchasing power, leaving only the incendiary tactic.
    view.politics = {...view.politics!,wallet:0};
    tactics.tick(player,view,gameplay.view(player,world),match,world,
      point=>Object.assign(player,point),()=>{rests++;},()=>{},()=>{});
    if (now===22_000) expect(match.fireInteraction(player,now,Infinity,true,false)?.progress).toBeDefined();
  }
  expect(rests).toBeGreaterThanOrEqual(4);
});
