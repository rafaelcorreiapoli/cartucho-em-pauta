import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Gameplay} from '../../server/Gameplay';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {npcs} from '../npcs';
import {binoculars} from '../equipment';
import {EquippedGear,equippedGearState} from './equipped-gear';

test('slots keep their positions while displaying the server-confirmed equipment and countdown',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,x:npcs.vendor.x,y:npcs.vendor.y+11,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  game.reset(0,()=>.9,[player]);
  const at = (now:number)=>match.gameplayWorld([player],now,()=>false);
  const render = (now:number)=>renderToStaticMarkup(
    <EquippedGear state={equippedGearState(game.view(player,at(now)))!} activate={()=>{}}/>,
  );
  const before = render(0);
  expect(before.match(/class="gear-slot"/g)).toHaveLength(5);
  expect(before.match(/class="gear-slot-empty"/g)).toHaveLength(5);
  expect(before).not.toContain('aria-keyshortcuts');
  game.act(player,{kind:'open-shop',target:'vendor'},at(1));
  game.act(player,{kind:'shop-buy',target:'binoculars',token:game.view(player,at(1)).dialogue?.token},at(1));
  expect(game.view(player,at(1)).equipped?.map(item=>item.kind)).toContain('binoculars');
  expect(render(2)).toContain('aria-keyshortcuts="B"');
  expect(render(2).match(/class="gear-slot"/g)).toHaveLength(5);
  game.act(player,{kind:'use-binoculars'},at(3));
  expect(render(3)).toContain(`Ativo: ${binoculars.duration/1000} s`);
  expect(render(3)).toContain('data-active="true"');
  expect(render(3+binoculars.duration)).toContain(`Recarga: ${binoculars.cooldown/1000} s`);
  expect(render(3+binoculars.duration)).toContain('data-active="false"');
  expect(render(3+binoculars.duration+binoculars.cooldown)).not.toContain('Recarga:');
});
