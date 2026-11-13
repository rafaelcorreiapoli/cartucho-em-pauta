import { button, contactFace, glyph, node } from './gameplay-ui';
import { objects, type GameplayAction } from './gameplay';
import { emptyPhotoAccess, PHOTO_LIMIT, type PhotoAccessView, type Photo, type PhotoScene } from './photography';
import type { Phase } from './plenary';
import type { Contact, DirectoryContact } from './politics';

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
    const figure = node('figure');
    figure.className = full ? 'album-photo album-photo-full' : 'album-photo';
    const canvas = node('canvas');
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label',`${photo.selfie ? 'Selfie' : 'Foto'} em ${photo.location} · ${photo.people.map(person=>person.name).join(', ')}`);
    drawPhoto(canvas,photo);
    figure.append(canvas,node('figcaption',full ? `${photo.author.name} · ${photo.location} · ${Math.floor(photo.at/1000)} s` : photo.location));
    if (full) {
      if (photo.source) figure.append(node('small',`Câmera escondida · ${photo.source.channel}`));
      const facts = photo.people.map(person=>[person.name,...(person.exposed ?? []).map(({kind})=>objects[kind].name)].join(' · '));
      if (facts.length) figure.append(node('small',facts.join(' / ')));
      for (const handoff of photo.transfers) {
        const from = photo.people.find(person=>person.id===handoff.from)?.name;
        const to = photo.people.find(person=>person.id===handoff.to)?.name;
        figure.append(node('small',`Entrega recente · ${from} → ${to} · ${objects[handoff.kind].name}`));
      }
    }
    return figure;
  }

  function photoGrid(photos:Photo[], empty:string) {
    if (!photos.length) return node('p',empty);
    const grid = node('div');
    grid.className = 'album-grid';
    for (const photo of [...photos].reverse()) {
      const tile = button('',()=>{photoId=photo.id;render();});
      tile.className = 'album-tile';
      tile.setAttribute('aria-label',`Abrir fotografia ${photo.id} · ${photo.location}`);
      tile.append(photoView(photo,false));
      grid.append(tile);
    }
    return grid;
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
    stopPreview() { cameraPreview = undefined; },
    closePresentation() { if (showing) closePresentation(); },
    albumKey(contacts:Contact[], press:boolean) {
      return [albumTab,photos.album.map(({photo})=>photo.id),photos.publicPhotos.map(photo=>photo.id),
        showing && photos.shown,photoId,photoRecipient,contacts,press];
    },
    renderCamera(cards:HTMLElement[], phase:Phase, openAlbum:()=>void) {
      cameraPreview = node('canvas');
      cameraPreview.className = 'camera-preview';
      cameraPreview.setAttribute('aria-label','Enquadramento da câmera');
      drawPhoto(cameraPreview);
      cards.push(cameraPreview);
      const capture = (label:string,kind:'photo'|'selfie') => {
        const shutter = button(label,()=>send({kind}));
        shutter.disabled = phase!=='negotiation' || photos.album.length>=PHOTO_LIMIT;
        shutter.prepend(glyph('camera'));
        return shutter;
      };
      cards.push(capture('Tirar foto','photo'),capture('Selfie','selfie'));
      cards.push(button(`Abrir álbum · ${photos.album.length}/${PHOTO_LIMIT}`,openAlbum));
    },
    renderAlbum(cards:HTMLElement[], contacts:Contact[], directory:DirectoryContact[], publishable:boolean) {
      const entry = albumTab==='personal' ? photos.album.find(entry=>entry.photo.id===photoId) : undefined;
      const published = albumTab==='public' ? photos.publicPhotos.find(photo=>photo.id===photoId) : undefined;
      if (!showing && !entry && !published) {
        const tabs = node('div');
        tabs.className = 'album-tabs';
        for (const [tab,label] of [['personal','Minhas fotos'],['public','Publicadas']] as const) {
          const switcher = button(label,()=>{albumTab=tab;photoId=photoRecipient=undefined;render();});
          switcher.setAttribute('aria-pressed',String(albumTab===tab));
          tabs.append(switcher);
        }
        cards.push(tabs);
      }
      if (showing && photos.shown) {
        cards.push(photoView(photos.shown,true),button('Fechar apresentação',closePresentation));
      } else if (published) {
        cards.push(button('Voltar às publicadas',()=>{photoId=undefined;render();}),photoView(published,true));
      } else if (entry) {
        cards.push(button('Voltar ao álbum',()=>{photoId=photoRecipient=undefined;render();}),photoView(entry.photo,true));
        cards.push(node('p',entry.access==='original' ? 'Original' : 'Cópia verificada'));
        if (contacts.length) {
          const list = node('div');
          list.className = 'photo-contacts';
          for (const person of contacts) {
            const choice = button(person.name,()=>{photoRecipient=person.id;render();});
            choice.classList.add('photo-contact');
            choice.setAttribute('aria-pressed',String(photoRecipient===person.id));
            choice.prepend(contactFace(directory.find(contact=>contact.id===person.id) ?? person));
            list.append(choice);
          }
          cards.push(list);
        }
        if (contacts.some(person=>person.id===photoRecipient)) {
          for (const [kind,label] of [['info-show','Mostrar'],['info-copy','Enviar cópia']] as const) {
            cards.push(button(label,()=>send({kind,item:entry.photo.id,target:photoRecipient})));
          }
        }
        if (publishable && !photos.publicPhotos.some(photo=>photo.id===entry.photo.id)) {
          cards.push(button('Publicar foto',()=>send({kind:'photo-publish',item:entry.photo.id})));
        }
        cards.push(button('Excluir do meu álbum',()=>send({kind:'photo-delete',item:entry.photo.id})));
      } else cards.push(albumTab==='public' ?
        photoGrid(photos.publicPhotos,'Nenhuma foto publicada.') :
        photoGrid(photos.album.map(entry=>entry.photo),'O álbum está vazio.'));
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
