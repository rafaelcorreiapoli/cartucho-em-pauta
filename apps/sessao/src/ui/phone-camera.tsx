import {useState} from 'react';
import {useDialogKeys} from './use-dialog-keys';
import {PhoneContactFace} from './phone-call';
import type {Ref} from 'react';
import type {GameplayAction} from '../gameplay';
import {PHOTO_LIMIT} from '../photography';

export function PhoneCamera({count,available,preview,send,openAlbum,character,close}:{
  character?:number; count:number; available:boolean; preview:Ref<HTMLCanvasElement>;
  send:(action:GameplayAction)=>void; openAlbum:()=>void; close?:()=>void;
}) {
  const [selfie,setSelfie] = useState(false);
  const disabled = !available || count>=PHOTO_LIMIT;
  const takePhoto = ()=>{ if (!disabled) send({kind:selfie ? 'selfie' : 'photo'}); };
  const toggleSelfie = ()=>{ if (!disabled) setSelfie(current=>!current); };
  const entries = [
    ...(close ? [{name:'Fechar aplicativo',activate:close}] : []),
    {name:'Abrir álbum',activate:openAlbum},
    ...(disabled ? [] : [{name:'Tirar foto',activate:takePhoto},{name:'Selfie',activate:toggleSelfie}]),
  ];
  const panel = useDialogKeys(key=>key==='3' ? openAlbum : disabled ? undefined :
    key==='1' ? takePhoto : key==='2' ? toggleSelfie : undefined,entries);
  return <section ref={panel} className="phone-camera">
    <div className="phone-camera-viewfinder">
      {selfie && <div className="camera-selfie-portrait"><PhoneContactFace person={{id:"self",name:"Você",character}}/></div>}
      <canvas ref={preview} className="camera-preview" role="img" aria-label="Enquadramento da câmera"/>
    </div>
    <div className="phone-camera-controls">
      <button type="button" className="camera-gallery" aria-keyshortcuts="3" aria-label={`Abrir álbum · ${count}/${PHOTO_LIMIT}`} onClick={openAlbum}>
        <svg className="hud-glyph" aria-hidden="true"><use href="#icon-app-photos"/></svg>
        <small>{count}/{PHOTO_LIMIT}</small><kbd className="action-key" aria-hidden="true">3</kbd>
      </button>
      <button type="button" className="camera-shutter" aria-label="Tirar foto" disabled={disabled}
        aria-keyshortcuts="1" onClick={takePhoto}>
        <span aria-hidden="true"/><kbd className="action-key" aria-hidden="true">1</kbd>
      </button>
      <button type="button" className="camera-selfie" aria-label="Selfie" disabled={disabled}
        aria-keyshortcuts="2" aria-pressed={selfie} onClick={toggleSelfie}>
        <svg className="hud-glyph" aria-hidden="true"><use href="#icon-camera"/></svg><small>Selfie</small><kbd className="action-key" aria-hidden="true">2</kbd>
      </button>
    </div>
  </section>;
}
