import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Gameplay} from '../../server/Gameplay';
import {INVENTORY_SLOTS,hasInventorySpace} from '../gameplay';
import {decorationActions,installationSites} from '../installations';
import {npcs} from '../npcs';
import type {Player} from '../map';
import type {Decoration} from '../photography';
import {DecorationCard,GameplayDialogHeader} from './gameplay-dialog';

test('an app offers back while the inventory and phone home can close the native dialog',()=>{
  const phone = renderToStaticMarkup(<GameplayDialogHeader title="Celular"/>);
  const bag = renderToStaticMarkup(<GameplayDialogHeader title="Inventário" bag/>);
  const app = renderToStaticMarkup(<GameplayDialogHeader title="Pix" back={()=>{}}/>);
  expect(phone).toContain('method="dialog"');
  expect(phone).toContain('type="submit"');
  expect(phone).toContain('href="#icon-cross"');
  expect(bag).toContain('bag-title-icon');
  expect(app).toContain('aria-label="Fechar aplicativo" aria-keyshortcuts="Escape"');
  expect(app).toContain('id="phone-back" type="button"');
  expect(app).toContain('href="#icon-cross"');
  expect(app).not.toContain('method="dialog"');
});

test('the decoration card distinguishes public actions from protected cabinet fixtures',()=>{
  const portrait:Decoration = {id:1,x:10,y:20,kind:'portrait',owner:{id:'host',name:'Rafa'},character:1};
  const render = (decoration:Decoration,ownId='visitor',exploring=true)=>
    renderToStaticMarkup(<DecorationCard decoration={decoration} ownId={ownId} exploring={exploring} canRemove send={()=>{}}/>);
  expect(render(portrait)).toContain('>Rabiscar</button>');
  expect(render(portrait,'host')).not.toContain('>Rabiscar</button>');
  expect(render(portrait,'visitor',false)).not.toContain('>Retirar</button>');
  expect(render({...portrait,marked:true})).toContain('Retrato rabiscado');
  expect(render({...portrait,kind:'pizza'})).toContain('Pegar uma fatia');
  expect(render({...portrait,kind:'officeTv',privateOffice:'office-01'})).not.toContain('<button');
});

test('a full inventory disables public decoration removal until a slot is freed',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,direction:0,moving:false,...npcs.credentialsVendor.interaction};
  const game = new Gameplay();
  const world = {players:[player],now:1,voice:()=>false,office:()=>undefined,spend:()=>true,earn:()=>{},publish:()=>{}};
  game.act(player,{kind:'open-shop',target:'credentialsVendor'},world);
  const token = game.view(player,world).dialogue?.token;
  expect(game.act(player,{kind:'shop-buy',target:'vip',token},world)).toBe('Compra guardada no inventário.');
  const [plate] = game.view(player,world).inventory;
  Object.assign(player,installationSites.lobbyVip.point);
  expect(game.act(player,{kind:'install',place:'lobbyVip',item:plate.id},world)).toBe('Objeto instalado.');
  for (let i=0;i<INVENTORY_SLOTS;i++) Reflect.get(game,'create').call(game,'document',{holder:player.id});
  const render = (state:ReturnType<Gameplay['view']>)=>renderToStaticMarkup(
    <DecorationCard decoration={state.decorations.find(item=>item.id===plate.id)!} ownId={player.id}
      exploring canRemove={state.interactive.some(item=>item.id===plate.id) && hasInventorySpace(state.inventory.length)} send={()=>{}}/>,
  );
  const full = game.view(player,world);
  expect(full.interactive.some(item=>item.id===plate.id)).toBe(true);
  expect(render(full)).toContain('disabled="">Retirar');
  expect(decorationActions(player.id,full)).toEqual([]);
  expect(game.act(player,{kind:'uninstall',item:plate.id},world)).toBe('Inventário cheio.');

  game.act(player,{kind:'drop',item:full.inventory[0].id},world);
  const open = game.view(player,world);
  expect(render(open)).not.toContain('disabled="">Retirar');
  const [remove] = decorationActions(player.id,open);
  expect(remove.action).toEqual({kind:'uninstall',item:plate.id});
  expect(game.act(player,remove.action,world)).toBe('Objeto retirado.');
});
