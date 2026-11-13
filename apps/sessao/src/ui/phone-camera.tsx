import type {Ref} from 'react';
import type {GameplayAction} from '../gameplay';
import {PHOTO_LIMIT} from '../photography';

export function PhoneCamera({count,available,preview,send,openAlbum}:{
  count:number; available:boolean; preview:Ref<HTMLCanvasElement>;
  send:(action:GameplayAction)=>void; openAlbum:()=>void;
}) {
  const disabled = !available || count>=PHOTO_LIMIT;
  return <>
    <canvas ref={preview} className="camera-preview" role="img" aria-label="Enquadramento da câmera"/>
    {([['photo','Tirar foto','5'],['selfie','Selfie','6']] as const).map(([kind,label,key])=>
      <button key={kind} type="button" className="hud-button hud-button--secondary" disabled={disabled}
        aria-keyshortcuts={key} onClick={()=>send({kind})}>
        <svg className="hud-glyph" aria-hidden="true"><use href="#icon-camera"/></svg>
        {label} <kbd className="action-key" aria-hidden="true">{key}</kbd>
      </button>)}
    <button type="button" className="hud-button hud-button--secondary" aria-keyshortcuts="7" onClick={openAlbum}>
      Abrir álbum · {count}/{PHOTO_LIMIT} <kbd className="action-key" aria-hidden="true">7</kbd>
    </button>
  </>;
}
