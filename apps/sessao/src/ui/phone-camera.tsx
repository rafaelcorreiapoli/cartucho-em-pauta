import {useState} from 'react';
import {PhoneContactFace} from './phone-call';
import type {Ref} from 'react';
import type {GameplayAction} from '../gameplay';
import {PHOTO_LIMIT} from '../photography';

export function PhoneCamera({count,available,preview,send,openAlbum,character}:{
  character?:number; count:number; available:boolean; preview:Ref<HTMLCanvasElement>;
  send:(action:GameplayAction)=>void; openAlbum:()=>void;
}) {
  const [selfie,setSelfie] = useState(false);
  const disabled = !available || count>=PHOTO_LIMIT;
  return <section className="phone-camera">
    <div className="phone-camera-viewfinder">
      {selfie && <div className="camera-selfie-portrait"><PhoneContactFace person={{id:"self",name:"Você",character}}/></div>}
      <canvas ref={preview} className="camera-preview" role="img" aria-label="Enquadramento da câmera"/>
    </div>
    <div className="phone-camera-controls">
      <button type="button" className="camera-gallery" aria-keyshortcuts="3" aria-label={`Abrir álbum · ${count}/${PHOTO_LIMIT}`} onClick={openAlbum}>
        <svg className="hud-glyph" aria-hidden="true"><use href="#icon-app-photos"/></svg>
        <small>{count}/{PHOTO_LIMIT} <kbd className="action-key" aria-hidden="true">3</kbd></small>
      </button>
      <button type="button" className="camera-shutter" aria-label="Tirar foto" disabled={disabled}
        aria-keyshortcuts="1" onClick={()=>send({kind:selfie ? 'selfie' : 'photo'})}>
        <span aria-hidden="true"/><kbd className="action-key" aria-hidden="true">1</kbd>
      </button>
      <button type="button" className="camera-selfie" aria-label="Selfie" disabled={disabled}
        aria-keyshortcuts="2" aria-pressed={selfie} onClick={()=>setSelfie(!selfie)}>
        <svg className="hud-glyph" aria-hidden="true"><use href="#icon-camera"/></svg><small>Selfie <kbd className="action-key" aria-hidden="true">2</kbd></small>
      </button>
    </div>
  </section>;
}
