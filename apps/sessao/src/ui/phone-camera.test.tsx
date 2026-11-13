import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PHOTO_LIMIT} from '../photography';
import {PhoneCamera} from './phone-camera';

test('camera shutter locks when the album is full or the session is in a vote',()=>{
  const render = (count:number,available:boolean)=>renderToStaticMarkup(
    <PhoneCamera count={count} available={available} preview={null} send={()=>{}} openAlbum={()=>{}}/>
  );
  const available = render(PHOTO_LIMIT-1,true);
  expect(available).toContain('aria-label="Enquadramento da câmera"');
  expect(available).not.toContain('disabled=""');
  for (const markup of [render(PHOTO_LIMIT,true),render(0,false)]) {
    expect(markup).toContain('disabled="" aria-keyshortcuts="5"');
    expect(markup).toContain('disabled="" aria-keyshortcuts="6"');
    expect(markup).toContain('aria-keyshortcuts="7" aria-label="Abrir álbum');
  }
});
