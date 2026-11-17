import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createPhonePhotos} from './phone-photos';
import type {Photo} from './photography';

test('the album renders private copies and opens incoming presentations',()=>{
  const timer = globalThis.setInterval;
  const clear = globalThis.clearInterval;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis,'window',{configurable:true,writable:true,value:{setInterval:timer,clearInterval:clear}});
  const album = createPhonePhotos(()=>{},()=>{},()=>{});
  try {
    const photo:Photo = {id:1,author:{id:'bia',name:'Bia'},at:1000,location:'Arquivo',selfie:true,
      center:{x:0,y:0},people:[],ground:[],decorations:[],transfers:[]};
    expect(album.update({album:[{photo,access:'copy'}],publicPhotos:[]})).toEqual({captured:false,presented:false});
    const grid = renderToStaticMarkup(album.renderAlbum([],[],()=>{}));
    expect(grid).toContain('Abrir fotografia 1 · Arquivo');
    expect(grid).toContain('Selfie em Arquivo');
    expect(album.hasUnpublished).toBe(true);
    expect(renderToStaticMarkup(album.renderPublication(true,()=>{}))).toContain('Abrir fotografia 1 · Arquivo');
    album.update({album:[{photo,access:'copy'}],publicPhotos:[photo]});
    expect(album.hasUnpublished).toBe(false);
    expect(renderToStaticMarkup(album.renderPublication(true,()=>{}))).not.toContain('Abrir fotografia 1 · Arquivo');
    expect(album.update({album:[],publicPhotos:[],shown:photo}).presented).toBe(true);
    const presentation = renderToStaticMarkup(album.renderAlbum([],[],()=>{}));
    expect(presentation).toContain('Fechar apresentação');
    expect(presentation).not.toContain('Publicar foto');
  } finally {
    album.destroy();
    if (originalWindow===undefined) Reflect.deleteProperty(globalThis,'window');
    else globalThis.window = originalWindow;
  }
});
