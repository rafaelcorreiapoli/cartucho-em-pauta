import type { OfficeGood } from './private-offices';
import type { Office } from './elections';
import type { ExposedItem, GroundItem, ObjectKind } from './gameplay';
import { localPerception, type Motion } from './map';
import type { Contact } from './politics';

export const PHOTO_WIDTH = 152;
export const PHOTO_HEIGHT = 128;
export const PHOTO_LOOK_UP = 19;
export const PHOTO_LIMIT = 12;
export const ROOM_PHOTO_LIMIT = 144;
export type PhotoPerson = Contact & Motion & {
  character:number; direction:number; moving?:boolean; pocketing?:boolean; knockedOut?:boolean; carried?:boolean; exposed?:ExposedItem[]; phone?:'call'|'game'; office?:Office;
};
export type Decoration = Motion & {
  id:number; kind:'portrait'|'vip'|'pizza'|Extract<OfficeGood,'officeTv'|'officeRug'|'officeChair'>; owner:Contact; character:number; marked?:boolean; slices?:number; privateOffice?:string;
};
export type PhotoScene = {
  center:Motion; camera?:Motion; breaches?:Motion[]; people:PhotoPerson[]; ground:GroundItem[]; decorations:Decoration[];
};
export type Photo = PhotoScene & {
  id:number; source?:{kind:"surveillance"; channel:string}; author:Contact; at:number; location:string; selfie:boolean;
  transfers:{from:string; to:string; kind:ObjectKind; item:number}[];
};
export type AlbumEntry = {photo:Photo; access:'original'|'copy'};
export type InformationRef = {kind:'photo'; id:number};
export type InformationRequest = {id:number; info:InformationRef; from:Contact; mode:'show'|'copy'};

export type PhotoAccessView = {
  album:AlbumEntry[]; publicPhotos:Photo[]; shown?:Photo; request?:InformationRequest;
};
export const emptyPhotoAccess:PhotoAccessView = {album:[],publicPhotos:[]};

export function inPhotoFrame(center:Motion, subject:Motion, person=false) {
  const top = center.y-PHOTO_HEIGHT/2-PHOTO_LOOK_UP;
  return Math.abs(center.x-subject.x)<PHOTO_WIDTH/2-(person ? 18 : 8) &&
    subject.y>=top+(person ? 50 : 16) && subject.y<top+PHOTO_HEIGHT-10 &&
    localPerception(center,subject).visible;
}
