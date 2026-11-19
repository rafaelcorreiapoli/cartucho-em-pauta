import {expect,test} from 'bun:test';
import {Gameplay} from './Gameplay';
import {NpcDialogues} from './NpcDialogues';
import {PersonalAgenda} from './PersonalAgenda';
import {PlenaryMatch} from './PlenaryMatch';
import {decorationProductEnabled} from '../src/market-catalog';
import {npcEnabled,npcs} from '../src/npcs';
import {installationSites} from '../src/installations';
import type {Player} from '../src/map';
import type {WorldItem} from '../src/gameplay';

const furnitureMissions = ['poltrona','ostentacao','gabinete','televisao','fotoOstentacao','doisMoveis'];
const portraitMissions = ['retratoGabinete','retrato','autorretrato','cerimonialOficial','reforma','reserva','fiscalVip','mandaVip','solenidadeInauguracao','privilegioAdquirido','reuniaoVip','rabiscarRetrato'];
const metrics = {wallet:8,popularity:40};

test.each([[true,true],[false,true],[true,false],[false,false]])('furniture=%s and portraits/VIP=%s are independent in missions, catalogs and NPCs',(furniture,portraits)=>{
  for (let seed=0;seed<50;seed++) {
    const agenda = new PersonalAgenda(metrics,6,()=>seed/50,()=>{},new Set(),true,true,true,true,true,furniture,portraits);
    const deck = Reflect.get(agenda,'missionDeck') as string[];
    for (const mission of furnitureMissions) expect(deck.includes(mission)).toBe(furniture);
    for (const mission of portraitMissions) expect(deck.includes(mission)).toBe(portraits);
    expect(agenda.view(metrics).active.some(({kind})=>!furniture && furnitureMissions.includes(kind) || !portraits && portraitMissions.includes(kind))).toBe(false);
  }
  for (const kind of ['officeTv','officeRug','officeChair']) expect(decorationProductEnabled(kind,furniture,portraits)).toBe(furniture);
  for (const kind of ['portrait','vip']) expect(decorationProductEnabled(kind,furniture,portraits)).toBe(portraits);
  expect(decorationProductEnabled('pizza',furniture,portraits)).toBe(true);
  expect(decorationProductEnabled('doorLock',furniture,portraits)).toBe(true);
  expect(npcEnabled('furnitureVendor',true,furniture,portraits)).toBe(furniture);
  expect(npcEnabled('credentialsVendor',true,furniture,portraits)).toBe(portraits);
  const dialogue = new NpcDialogues();
  dialogue.decorationsEnabled = furniture;
  dialogue.portraitsAndVipEnabled = portraits;
  for (const [id,enabled] of [['furnitureVendor',furniture],['credentialsVendor',portraits]] as const) {
    const player:Player = {id:'a',nick:'Rafa',character:0,...npcs[id].interaction,direction:0,moving:false};
    expect(dialogue.nearbyNpcs(player).includes(id)).toBe(enabled);
    expect(dialogue.open(player,id)===undefined).toBe(enabled);
    dialogue.close(player.id);
  }
});

test.each([[false,true],[true,false],[false,false]])('server purchases respect independent furniture=%s and portraits=%s',(furniture,portraits)=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,x:140,y:146,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>.9,1,false,true,true,true,true,true,furniture,portraits);
  const game = new Gameplay();
  game.reset(0,()=>.9,[player]);
  game.decorationsEnabled = furniture;
  game.portraitsAndVipEnabled = portraits;
  const world = match.gameplayWorld([player],1,()=>false);
  for (const [npc,target,enabled] of [['furnitureVendor','officeChair',furniture],['credentialsVendor','portrait',portraits]] as const) {
    Object.assign(player,npcs[npc].interaction);
    game.act(player,{kind:'open-shop',target:npc},world);
    const token = game.view(player,world).dialogue?.token;
    const result = game.act(player,{kind:'shop-buy',target,token},world);
    if (!enabled) expect(result).toContain('desativad');
    else if (target==='portrait') expect(game.owns(player.id,'portrait')).toBe(true);
    else expect(game.view(player,world).officeFurnishings).toContain('officeChair');
    game.act(player,{kind:'dialogue-close'},world);
  }
});

test('pizza installation and service remain available when furniture, portraits and VIP are all disabled',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,...installationSites.pizza.point,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>.9);
  const game = new Gameplay();
  game.reset(0,()=>.9,[player]);
  game.decorationsEnabled = game.portraitsAndVipEnabled = false;
  const portrait = Reflect.get(game,'create').call(game,'portrait',{holder:player.id}) as WorldItem;
  const chair = Reflect.get(game,'create').call(game,'officeChair',{holder:player.id}) as WorldItem;
  expect(game.act(player,{kind:'install',place:'hall',item:portrait.id},match.gameplayWorld([player],1,()=>false))).toBe('Retratos e área VIP desativados nesta partida.');
  expect(game.act(player,{kind:'office-install',item:chair.id},match.gameplayWorld([player],1,()=>false))).toBe('Decoração desativada nesta partida.');
  const pizza = Reflect.get(game,'create').call(game,'pizza',{holder:player.id}) as WorldItem;
  const world = match.gameplayWorld([player],1,()=>false);
  expect(game.act(player,{kind:'install',place:'pizza',item:pizza.id},world)).toBe('Objeto instalado.');
  expect(game.view(player,world).interactive.map(({kind})=>kind)).toEqual(['pizza']);
  expect(game.act(player,{kind:'slice',item:pizza.id},world)).toBeDefined();
  expect(game.view(player,world).decorations[0].slices).toBe(5);
});
