import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ContextOverflow} from './context-overflow';

test('the overflow trigger and its shortcut reflect the visible overflow row',()=>{
  const render = (visible:boolean,expanded:boolean,shortcut?:string)=>renderToStaticMarkup(
    <ContextOverflow visible={visible} expanded={expanded} shortcut={shortcut} toggle={()=>{}}/>);
  expect(render(false,false)).toBe('');
  const collapsed = render(true,false,'4');
  expect(collapsed).toContain('aria-expanded="false" aria-keyshortcuts="4"');
  expect(collapsed).not.toContain('context-overflow-break');
  const expanded = render(true,true,'4');
  expect(expanded).toContain('aria-expanded="true" aria-keyshortcuts="4"');
  expect(expanded).toContain('context-overflow-break');
  expect(render(true,false)).not.toContain('aria-keyshortcuts');
});
