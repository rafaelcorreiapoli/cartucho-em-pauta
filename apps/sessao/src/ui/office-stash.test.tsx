import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {OfficeStash} from './office-stash';

test('the cabinet keeps ten slots and offers distinct deposit and withdrawal shortcuts',()=>{
  const html = renderToStaticMarkup(<OfficeStash stash={{id:'1',level:2,items:[{id:7,kind:'pizza'}]}}
    inventory={[{id:8,kind:'coffee'}]} send={()=>{}}/>);
  expect(html).toContain('Segurança nível 2');
  expect(html).toContain('aria-label="Retirar Pizza" aria-keyshortcuts="1"');
  expect(html).toContain('aria-keyshortcuts="Shift+1"');
  expect(html.match(/item-tile-empty/g)).toHaveLength(8);
});

test('a full cabinet disables deposits while leaving withdrawals available',()=>{
  const html = renderToStaticMarkup(<OfficeStash stash={{id:'1',items:Array.from({length:4},(_,id)=>({id,kind:'pizza'}))}}
    inventory={[{id:8,kind:'coffee'}]} send={()=>{}}/>);
  expect(html).toContain('Armário arrombado');
  expect(html.match(/ disabled=""/g)).toHaveLength(1);
});
