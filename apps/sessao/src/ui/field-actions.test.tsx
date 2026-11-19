import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Gameplay} from '../../server/Gameplay';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {canStand,type Player} from '../map';
import {fireSites,fireRules} from '../fire';
import {terminals} from '../gameplay';
import {powerPanels,powerRules} from '../power';
import {ContextActionButton} from './context-action-button';
import {fieldActions} from './field-actions';

test('the power controls project room authority and live panel positions into contextual actions',()=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    id:nick,nick,character,direction:0,moving:false,...powerPanels[character===1 ? 1 : 0],
  }));
  const [host,helper,infiltrator] = players;
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  expect(match.start(host.id,players,0,()=>.9)).toBe(true);
  game.reset(0,()=>.9,players);
  const powerControls = (player:Player,now:number)=>{
    const world = match.gameplayWorld(players,now,()=>false);
    const view = {...match.view(player.id,ids,now),gameplay:game.view(player,world)};
    return fieldActions(view,player,players).flatMap(({action,...button})=>
      action.kind==='power' ? [{option:action.option,button}] : []);
  };

  expect(powerControls(host,1)).toEqual([]);
  expect(match.actOnPower(host,{kind:'sabotage',panel:0},1)).toBeUndefined();
  const [cut] = powerControls(infiltrator,1);
  expect(cut.option).toMatchObject({kind:'sabotage',panel:0});
  expect(renderToStaticMarkup(<ContextActionButton {...cut.button} activate={()=>{}}/>)).toContain('Cortar energia');
  expect(match.actOnPower(infiltrator,cut.option,1)).toBe('Energia cortada.');

  const [repairA] = powerControls(host,2);
  const [repairB] = powerControls(helper,2);
  expect(repairA.option).toMatchObject({kind:'repair',panel:0});
  expect(repairB.option).toMatchObject({kind:'repair',panel:1});
  match.actOnPower(host,repairA.option,2);
  expect(powerControls(infiltrator,2)).toEqual([]);
  expect(powerControls(host,2)[0].option.kind).toBe('cancel');
  match.actOnPower(helper,repairB.option,2);
  const repairedAt = 2+powerRules.repairMs;
  match.advancePower(repairedAt,id=>players.find(player=>player.id===id));
  expect(match.view(host.id,ids,repairedAt).outage).toBeUndefined();
  expect(powerControls(host,repairedAt)).toEqual([]);
  expect(powerControls(helper,repairedAt)).toEqual([]);
});

test('a blocked context button renders its reason and disabled state',()=>{
  const html = renderToStaticMarkup(<ContextActionButton label="Instalar escuta" icon="search"
    blocked="Sem espaço" activate={()=>{}}/>);
  expect(html).toContain('disabled=""');
  expect(html).toContain('Instalar escuta<small> · Sem espaço</small>');
});


test('offering an inventory item targets nearby humans and bots in the field',()=>{
  const host:Player = {id:'host',nick:'Rafa',character:0,direction:0,moving:false,...terminals.coffee.point};
  const guest = {...host,id:'guest',nick:'Bia'};
  const bot:Player = {...host,id:'bot',nick:'Bot',bot:true};
  const players = [host,guest,bot];
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  expect(match.start(host.id,players,0,()=>.9)).toBe(true);
  const ids = players.map(({id})=>id);
  const world = match.gameplayWorld(players,0,()=>false);
  const offers = ()=>fieldActions({...match.view(host.id,ids,0),gameplay:game.view(host,world)},host,players)
    .filter(({action})=>action.kind==='offer-item');

  expect(offers()).toEqual([]);
  game.giveTrainingItem(host.id,'coffee');
  expect(offers()).toEqual([expect.objectContaining({
    label:'Oferecer item · Bia',action:{kind:'offer-item',target:guest.id},
  }),expect.objectContaining({action:{kind:'offer-item',target:bot.id}})]);
  const [coffee] = game.view(host,world).inventory;
  expect(game.act(host,{kind:'offer',item:coffee.id,target:bot.id},world)).toBe('Pedido enviado.');
  guest.x += 100;
  bot.x += 100;
  expect(offers()).toEqual([]);
});


test('signature actions target a nearby bot directly or expand document choices',()=>{
  const host:Player = {id:'host',nick:'Rafa',character:0,direction:0,moving:false,...terminals.secretary.point};
  const bot:Player = {...host,id:'bot',nick:'Bot',bot:true};
  const players = [host,bot];
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  match.start(host.id,players,0,()=>.9);
  const world = match.gameplayWorld(players,1,()=>true);
  game.act(host,{kind:'supply',place:'secretary'},world);
  const first = game.view(host,world).inventory.find(item=>item.document)!;
  const actions = (expanded?:string)=>fieldActions({...match.view(host.id,['host','bot'],1),gameplay:game.view(host,world)},host,players,expanded)
    .filter(entry=>entry.action.kind==='sign-request');
  bot.x = host.x+40;
  expect(actions()).toHaveLength(1);
  expect(actions()[0].action).toEqual({kind:'sign-request',target:bot.id,item:first.id});
  game.act(host,{kind:'drop',item:first.id},world);
  game.act(host,{kind:'supply',place:'secretary'},world);
  game.act(host,{kind:'collect',item:first.id},world);
  expect(actions()).toHaveLength(1);
  expect(actions()[0].action).toEqual({kind:'sign-request',target:bot.id});
  const choices = actions(bot.id).filter(entry=>entry.documentChoice);
  expect(choices).toHaveLength(2);
  expect(new Set(choices.map(entry=>'item' in entry.action && entry.action.item)).size).toBe(2);
  first.document!.signatures.push({id:bot.id,name:bot.nick});
  expect(actions()).toHaveLength(1);
  expect(actions()[0].action).toHaveProperty('item');
  bot.x = host.x+49;
  expect(actions()).toEqual([]);
});

test('parliamentarians and infiltrators can plant incendiaries in every cabinet through contextual actions',()=>{
  const cabinets = fireSites.flatMap((target,site)=>target.object==='Armário' ? [{target,site}] : []);
  expect(cabinets).toHaveLength(11);
  for (const {target,site} of cabinets) {
    const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
      id:nick,nick,character,direction:0,moving:false,x:target.x,y:target.y+10,
    }));
    expect(canStand(players[0].x,players[0].y)).toBe(true);
    for (const actor of [players[0],players[2]]) {
      const match = new PlenaryMatch(1);
      match.start(players[0].id,players,0,()=>.9);
      const ids = players.map(player=>player.id);
      const view = match.view(actor.id,ids,0);
      expect(view.role).toBe(actor===players[0] ? 'Parlamentar' : 'Infiltrado');
      view.fireInteraction = match.fireInteraction(actor,0,86,true,false);
      const action = fieldActions(view,actor,players).find(({action})=>action.kind==='fire')?.action;
      expect(action).toMatchObject({kind:'fire',option:{kind:'plant',site}});
      if (action?.kind!=='fire') throw Error('Ação de incendiário ausente');
      expect(match.actOnFire(actor,action.option.kind,action.option.site,0,false,123)).toBe('Instalando dispositivo…');
      match.advance(fireRules.install);
      expect(match.updateFireInstallation(fireRules.install,id=>players.find(player=>player.id===id),()=>true,()=>true))
        .toEqual([{actor:actor.id,feedback:'Incendiário instalado.',failed:false}]);
      const ignition = fireRules.install+fireRules.fuse;
      match.advance(ignition);
      expect(match.view(actor.id,ids,ignition).fires?.map(fire=>fire.site)).toEqual([site]);
    }
  }
});
