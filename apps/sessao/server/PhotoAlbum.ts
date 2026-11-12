import { PHOTO_LIMIT, ROOM_PHOTO_LIMIT, type AlbumEntry, type InformationRef, type Photo } from '../src/photography';
import { canReachObject, type GameplayAction } from '../src/gameplay';
import type { Player } from '../src/map';
import { InformationRequests } from './InformationRequests';

export class PhotoAlbum {
  private photos = new Map<number,Photo>();
  private albums = new Map<string,Set<number>>();
  private publicPhotos = new Set<number>();
  private shown = new Map<string,number>();
  private requests = new InformationRequests<InformationRef>(()=>this.revision++);
  private lastCapture = new Map<string,number>();
  private serial = 0;
  revision = 0;

  reset() {
    this.photos.clear();
    this.albums.clear();
    this.publicPhotos.clear();
    this.shown.clear();
    this.requests.clear();
    this.lastCapture.clear();
    this.revision++;
  }

  private entries(id:string) {
    let album = this.albums.get(id);
    if (!album) this.albums.set(id,album = new Set());
    return album;
  }

  private prune(id:number) {
    if (this.publicPhotos.has(id) || [...this.albums.values()].some(album=>album.has(id)) ||
      [...this.shown.values()].includes(id)) return;
    this.photos.delete(id);
  }

  capture(id:string, now:number, makePhoto:(id:number)=>Photo) {
    const album = this.entries(id);
    if (album.size>=PHOTO_LIMIT || this.photos.size>=ROOM_PHOTO_LIMIT) return 'Álbum cheio. Exclua uma foto para liberar espaço.';
    if (now-(this.lastCapture.get(id) ?? -Infinity)<900) return 'Aguarde um instante para tirar outra foto.';
    const photo = makePhoto(++this.serial);
    this.lastCapture.set(id,now);
    this.photos.set(photo.id,photo);
    album.add(photo.id);
    this.revision++;
    return photo;
  }

  view(id:string, now:number) {
    const album:AlbumEntry[] = [...this.entries(id)].map(key=>{
      const photo = this.photos.get(key)!;
      return {photo,access:photo.author.id===id ? 'original' : 'copy'};
    });
    const shown = this.shown.get(id);
    return {album,publicPhotos:[...this.publicPhotos].map(key=>this.photos.get(key)!),
      shown:shown===undefined ? undefined : this.photos.get(shown),
      request:this.requests.incoming(id,now)};
  }

  tick(now:number) {
    this.requests.removeWhere(request=>request.expires<=now);
  }

  leave(id:string, permanent:boolean) {
    this.requests.removeWhere(request=>request.from.id===id || request.to===id);
    if (!permanent) return;
    this.closePresentation(id);
    const album = this.albums.get(id);
    if (this.albums.delete(id)) this.revision++;
    for (const photo of album ?? []) this.prune(photo);
    this.lastCapture.delete(id);
  }

  private closePresentation(id:string) {
    const shown = this.shown.get(id);
    this.shown.delete(id);
    if (shown!==undefined) {
      this.revision++;
      this.prune(shown);
    }
  }

  act(player:Player, action:GameplayAction, players:Player[], now:number, press:boolean,
    publish:(type:'photo-shown'|'photo-shared'|'photo-published', photo:Photo, actor:Player, target?:string)=>void) {
    const key = action.item ?? -1;
    const album = this.entries(player.id);
    if (action.kind==='info-close') {
      this.closePresentation(player.id);
      return;
    }
    if (action.kind==='info-accept' || action.kind==='info-decline') {
      const response = this.requests.respond(key,player,players,now,action.kind==='info-accept');
      if (typeof response==='string') return response;
      const {entry:request,sender} = response;
      const photo = this.photos.get(request.info.id);
      if (!photo || !this.entries(sender.id).has(photo.id)) return 'Foto indisponível.';
      if (request.mode==='copy') {
        if (album.has(photo.id)) return 'Você já tem esta foto.';
        if (album.size>=PHOTO_LIMIT) return 'Seu álbum está cheio.';
        album.add(photo.id);
        this.revision++;
      } else {
        this.closePresentation(player.id);
        this.shown.set(player.id,photo.id);
        this.revision++;
      }
      publish(request.mode==='copy' ? 'photo-shared' : 'photo-shown',photo,sender,player.id);
      return request.mode==='copy' ? 'Cópia recebida.' : 'Fotografia apresentada.';
    }
    const photo = this.photos.get(key);
    if (!photo || !album.has(key)) return 'Foto indisponível.';
    if (action.kind==='photo-delete') {
      album.delete(key);
      this.revision++;
      this.requests.removeWhere(request=>request.info.id===key && request.from.id===player.id);
      this.prune(key);
      return 'Foto removida do seu álbum.';
    }
    if (action.kind==='photo-publish') {
      if (!press) return 'Divulgue pela Sala de Imprensa.';
      if (this.publicPhotos.has(key)) return 'Esta foto já está nas Notícias.';
      this.publicPhotos.add(key);
      this.revision++;
      publish('photo-published',photo,player);
      return 'Fotografia publicada nas Notícias.';
    }
    const target = players.find(person=>person.id===action.target && person.id!==player.id && canReachObject(player,person));
    if (!target) return 'Aproxime-se do destinatário.';
    if (action.kind==='info-copy' && this.entries(target.id).has(key)) return 'Esse jogador já tem a fotografia.';
    return this.requests.send(player,target,{kind:'photo',id:key},action.kind==='info-copy' ? 'copy' : 'show',now);
  }
}
