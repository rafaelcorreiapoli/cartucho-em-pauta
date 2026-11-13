import type {Ref} from 'react';
import type {GameplayAction} from '../gameplay';
import {PHOTO_LIMIT} from '../photography';

export function PhoneCamera({count,available,preview,send,openAlbum}:{
  count:number; available:boolean; preview:Ref<HTMLCanvasElement>;
  send:(action:GameplayAction)=>void; openAlbum:()=>void;
}) {
  const disabled = !available || count>=PHOTO_LIMIT;
  return <section className="phone-camera">
    <div className="phone-camera-viewfinder">
      <canvas ref={preview} className="camera-preview" role="img" aria-label="Enquadramento da câmera"/>
    </div>
    <div className="phone-camera-controls">
      <button type="button" className="camera-gallery" aria-keyshortcuts="7" aria-label={`Abrir álbum · ${count}/${PHOTO_LIMIT}`} onClick={openAlbum}>
        <svg className="hud-glyph" aria-hidden="true"><use href="#icon-app-photos"/></svg>
        <small>{count}/{PHOTO_LIMIT}</small>
      </button>
      <button type="button" className="camera-shutter" aria-label="Tirar foto" disabled={disabled}
        aria-keyshortcuts="5" onClick={()=>send({kind:'photo'})}><span aria-hidden="true"/></button>
      <button type="button" className="camera-selfie" aria-label="Selfie" disabled={disabled}
        aria-keyshortcuts="6" onClick={()=>send({kind:'selfie'})}>
        <svg className="hud-glyph" aria-hidden="true"><use href="#icon-camera"/></svg><small>Selfie</small>
      </button>
    </div>
  </section>;
}
