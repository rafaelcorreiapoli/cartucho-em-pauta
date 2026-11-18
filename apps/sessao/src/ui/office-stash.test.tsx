import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {OfficeStash} from './office-stash';

test('the cabinet and nine-slot inventory offer distinct deposit and withdrawal shortcuts',()=>{
  const html = renderToStaticMarkup(<OfficeStash stash={{id:'1',level:2,items:[{id:7,kind:'pizza'}]}}
    inventory={[{id:8,kind:'coffee'}]} send={()=>{}} close={()=>{}}/>);
  expect(html).toContain('Segurança nível 2');
  expect(html).toContain('aria-label="Retirar Pizza" aria-keyshortcuts="1"');
  expect(html).toContain('aria-keyshortcuts="Shift+1"');
  expect(html).toContain("Armário <small>1/4</small>");
  expect(html).toContain("Inventário <small>1/9</small>");
  expect(html.match(/item-tile-empty/g)).toHaveLength(11);
});

test('a full cabinet disables deposits while leaving withdrawals available',()=>{
  const html = renderToStaticMarkup(<OfficeStash stash={{id:'1',items:Array.from({length:4},(_,id)=>({id,kind:'pizza'}))}}
    inventory={[{id:8,kind:'coffee'}]} send={()=>{}} close={()=>{}}/>);
  expect(html).toContain('Armário arrombado');
  expect(html.match(/ disabled=""/g)).toHaveLength(1);
});
