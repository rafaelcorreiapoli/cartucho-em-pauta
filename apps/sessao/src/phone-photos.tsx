import type {ReactNode} from 'react';
import {PhoneContactFace} from './ui/phone-call';
import { objects, type GameplayAction } from './gameplay';
import { emptyPhotoAccess, type PhotoAccessView, type Photo, type PhotoScene } from './photography';
import type { Contact, DirectoryContact } from './politics';

function AlbumButton({children,onClick}:{children:ReactNode;onClick:()=>void}) {
  return <button type="button" className="hud-button hud-button--secondary" onClick={onClick}>{children}</button>;
}

export function createPhonePhotos(
  send:(action:GameplayAction)=>void,
  drawPhoto:(canvas:HTMLCanvasElement,photo?:PhotoScene)=>void,
  render:()=>void,
) {
  let photos = emptyPhotoAccess;
  let albumTab:'personal'|'public' = 'personal';
  let photoId:number | undefined;
  let photoRecipient:string | undefined;
  let showing = false;
  let cameraPreview:HTMLCanvasElement | undefined;
  const previewTimer = window.setInterval(()=>{
    if (cameraPreview?.isConnected) drawPhoto(cameraPreview);
  },150);

  function photoView(photo:Photo, full:boolean) {
    const facts = photo.people.map(person=>[person.name,...(person.exposed ?? []).map(({kind})=>objects[kind].name)].join(' · '));
    return <figure className={full ? 'album-photo album-photo-full' : 'album-photo'}>
      <canvas role="img" aria-label={`${photo.selfie ? 'Selfie' : 'Foto'} em ${photo.location} · ${photo.people.map(person=>person.name).join(', ')}`}
        ref={canvas=>{if (canvas) drawPhoto(canvas,photo);}}/>
      <figcaption>{full ? `${photo.author.name} · ${photo.location} · ${Math.floor(photo.at/1000)} s` : photo.location}</figcaption>
      {full && <>
        {photo.source && <small>Câmera escondida · {photo.source.channel}</small>}
        {facts.length>0 && <small>{facts.join(' / ')}</small>}
        {photo.transfers.map((handoff,index)=><small key={index}>Entrega recente · {photo.people.find(person=>person.id===handoff.from)?.name} → {photo.people.find(person=>person.id===handoff.to)?.name} · {objects[handoff.kind].name}</small>)}
      </>}
    </figure>;
  }

  function photoGrid(entries:Photo[], empty:string) {
    if (!entries.length) return <p>{empty}</p>;
    return <div className="album-grid">
      {[...entries].reverse().map(photo=><button key={photo.id} type="button" className="album-tile"
        aria-label={`Abrir fotografia ${photo.id} · ${photo.location}`} onClick={()=>{photoId=photo.id;render();}}>
        {photoView(photo,false)}
      </button>)}
    </div>;
  }

  function closePresentation() {
    showing = false;
    send({kind:'info-close'});
    render();
  }

  return {
    get count() { return photos.album.length; },
    get request() { return photos.request; },
    resetSelection() {
      albumTab = 'personal';
      photoId = photoRecipient = undefined;
    },
    clearRecipient() { photoRecipient = undefined; },
    closePresentation() { if (showing) closePresentation(); },
    albumKey(contacts:Contact[], press:boolean) {
      return [albumTab,photos.album.map(({photo})=>photo.id),photos.publicPhotos.map(photo=>photo.id),
        showing && photos.shown,photoId,photoRecipient,contacts,press];
    },
    setPreview(canvas:HTMLCanvasElement|null) {
      cameraPreview = canvas ?? undefined;
      if (canvas) drawPhoto(canvas);
    },
    renderAlbum(contacts:Contact[], directory:DirectoryContact[], publishable:boolean) {
      const entry = albumTab==='personal' ? photos.album.find(entry=>entry.photo.id===photoId) : undefined;
      const published = albumTab==='public' ? photos.publicPhotos.find(photo=>photo.id===photoId) : undefined;
      const back = () => { photoId = photoRecipient = undefined; render(); };
      if (showing && photos.shown) return <>
        {photoView(photos.shown,true)}<AlbumButton onClick={closePresentation}>Fechar apresentação</AlbumButton>
      </>;
      if (published) return <>
        <AlbumButton onClick={back}>Voltar às publicadas</AlbumButton>{photoView(published,true)}
      </>;
      if (entry) {
        const item = entry.photo.id;
        const recipient = contacts.find(person=>person.id===photoRecipient);
        return <>
          <AlbumButton onClick={back}>Voltar ao álbum</AlbumButton>{photoView(entry.photo,true)}
          <p>{entry.access==='original' ? 'Original' : 'Cópia verificada'}</p>
          {contacts.length>0 && <div className="photo-contacts">
            {contacts.map(person=><button type="button" className="hud-button hud-button--secondary photo-contact" key={person.id}
              aria-pressed={photoRecipient===person.id} onClick={()=>{photoRecipient=person.id;render();}}>
              <PhoneContactFace person={directory.find(contact=>contact.id===person.id) ?? person}/>{person.name}
            </button>)}
          </div>}
          {recipient && <>
            <AlbumButton onClick={()=>send({kind:'info-show',item,target:recipient.id})}>Mostrar</AlbumButton>
            <AlbumButton onClick={()=>send({kind:'info-copy',item,target:recipient.id})}>Enviar cópia</AlbumButton>
          </>}
          {publishable && !photos.publicPhotos.some(photo=>photo.id===item) &&
            <AlbumButton onClick={()=>send({kind:'photo-publish',item})}>Publicar foto</AlbumButton>}
          <AlbumButton onClick={()=>send({kind:'photo-delete',item})}>Excluir do meu álbum</AlbumButton>
        </>;
      }
      return <>
        <div className="album-tabs">
          {([['personal','Minhas fotos'],['public','Publicadas']] as const).map(([tab,label])=>
            <button type="button" className="hud-button hud-button--secondary" key={tab} aria-pressed={albumTab===tab}
              onClick={()=>{albumTab=tab;back();}}>{label}</button>)}
        </div>
        {albumTab==='public' ? photoGrid(photos.publicPhotos,'Nenhuma foto publicada.') :
          photoGrid(photos.album.map(entry=>entry.photo),'O álbum está vazio.')}
      </>;
    },
    update(next:PhotoAccessView) {
      const captured = next.album.some(({photo,access})=>access==='original' && !photos.album.some(entry=>entry.photo.id===photo.id));
      const presented = !!next.shown && next.shown.id!==photos.shown?.id;
      photos = next;
      if (presented) showing = true;
      return {captured,presented};
    },
    flash() {
      if (cameraPreview?.isConnected) {
        cameraPreview.animate([{filter:'brightness(3)'},{filter:'brightness(1)'}],{duration:220});
      }
    },
    destroy() { window.clearInterval(previewTimer); },
  };
}
