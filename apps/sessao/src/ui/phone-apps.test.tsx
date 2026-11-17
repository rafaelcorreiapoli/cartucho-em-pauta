import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PhoneApps} from './phone-apps';

test('each phone app has a distinct hotkey and only the open app is selected',()=>{
  const markup = renderToStaticMarkup(<PhoneApps active="Câmera" select={()=>{}}/>);
  expect([...markup.matchAll(/aria-keyshortcuts="(\d+)"/g)].map(match=>match[1])).toEqual(['1','2','3','4','5','6','7']);
  expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(markup).toContain('data-app="app-camera" aria-pressed="true" aria-keyshortcuts="3"');
});
