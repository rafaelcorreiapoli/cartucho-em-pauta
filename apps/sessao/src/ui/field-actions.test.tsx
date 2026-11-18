import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Gameplay} from '../../server/Gameplay';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
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
