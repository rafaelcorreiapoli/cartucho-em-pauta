import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Gameplay} from './Gameplay';
import {InternalMail} from './InternalMail';
import {PersonalAgenda} from './PersonalAgenda';
import {PlenaryMatch} from './PlenaryMatch';
import {PhoneApps} from '../src/ui/phone-apps';
import {MailAttachmentPicker} from '../src/ui/mail-attachment-picker';
import {MailComposer} from '../src/ui/internal-mail';
import {legislativeStationActions} from '../src/ui/legislative-station-actions';
import type {Player} from '../src/map';
import type {Photo} from '../src/photography';
import type {GameplayWorld} from './gameplay-world';

const player:Player = {id:'a',nick:'Rafa',character:0,x:140,y:146,direction:0,moving:false};
const photo:Photo = {id:1,at:0,author:{id:'a',name:'Rafa'},center:player,selfie:true,location:'Corredor',people:[],ground:[],decorations:[],transfers:[]};
const metrics = {wallet:8,popularity:40};

test('photo missions are excluded from initial and replacement agendas while live surveillance remains',()=>{
  const blocked = ['selfieAlvo','selfieSolo','fotografia','flagra','selfie','presidenteFoto','celularFoto','reuniaoFoto','dossieFoto','apresentarFoto','entregaFoto','publicouSelfie','autorretrato','cerimonialOficial','fiscalVip','flagraGabinete','fotoOstentacao','fotoDinheiro','provaDocumental','registroHistorico','jornalismo','tresSelfies','turismo','selfieArrombamento','fotoNocaute'];
  for (let seed=0;seed<100;seed++) {
    const agenda = new PersonalAgenda(metrics,6,()=>seed/100,()=>{},new Set(),true,true,true,false);
    expect(agenda.view(metrics).active.some(({kind})=>blocked.includes(kind))).toBe(false);
    const deck = Reflect.get(agenda,'missionDeck') as string[];
    expect(deck.some(kind=>blocked.includes(kind))).toBe(false);
    for (const kind of ['instalarCamera','cameraGabinete','duasCameras','vigilanciaInstitucional','mensagemComAnexo']) expect(deck).toContain(kind);
    const allDisabled = new PersonalAgenda(metrics,6,()=>seed/100,()=>{},new Set(),false,false,false,false);
    expect((Reflect.get(allDisabled,'missionDeck') as string[])).not.toContain('mensagemComAnexo');
  }
});

test('server blocks capture, publication and sharing before changing the album',()=>{
  const game = new Gameplay();
  game.photosEnabled = false;
  for (const kind of ['photo','selfie','photo-delete','photo-publish','info-show','info-copy','info-accept','info-decline'] as const) {
    expect(game.act(player,{kind,item:photo.id},{} as GameplayWorld)).toBe('Fotos desativadas nesta partida.');
  }
  expect(game.spyAction(player,{kind:'capture',channel:1},{} as GameplayWorld)).toBe('Fotos desativadas nesta partida.');
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>.9,1,false,true,true,true,false);
  expect(match.submitComplaint(player,1,1,photo)).toBe('Fotos desativadas nesta partida.');
  const view = match.view(player.id,[player.id],1);
  expect(legislativeStationActions(view,'audit')).toEqual([]);
  expect(view.photosEnabled).toBe(false);
});

test('mail blocks new photo attachments and forwarding photos without charging or consuming cooldown',()=>{
  const mail = new InternalMail();
  let spent = 0;
  const world:GameplayWorld = {players:[player],now:0,voice:()=>false,earn:()=>{},office:()=>undefined,publish:()=>{},spend:(_,amount)=>{spent+=amount;return true;}};
  expect(mail.publish(player,{subject:'Foto',attachment:{kind:'photo',id:1}},world,()=>({attachment:{kind:'photo',photo}}))).toBeUndefined();
  const cost = spent;
  const other = {...player,id:'b'};
  mail.photosEnabled = false;
  expect(mail.publish(other,{subject:'Foto',attachment:{kind:'photo',id:1}},world,()=>({attachment:{kind:'photo',photo}}))).toBe('Fotos desativadas nesta partida.');
  expect(mail.publish(other,{subject:'Encaminhar',forwardedFrom:mail.view()[0].id},world)).toBe('Fotos desativadas nesta partida.');
  expect(spent).toBe(cost);
  expect(mail.nextPublicationAt(other.id)).toBe(0);
  expect(mail.publish(other,{subject:'Texto',body:'Aviso sem foto'},world)).toBeUndefined();
  expect(mail.publish({...player,id:'c'},{subject:'Documento',attachment:{kind:'document',id:2}},world,
    ()=>({attachment:{kind:'document',document:{id:2,title:'Documento',signatures:[]}}}))).toBeUndefined();
});

test('HUD hides camera, album and photo attachments while preserving other apps and documents',()=>{
  const phone = renderToStaticMarkup(<PhoneApps photosEnabled={false} select={()=>{}}/>);
  expect(phone).not.toContain('Câmera');
  expect(phone).not.toContain('Álbum');
  expect(phone).toContain('Telefone');
  expect(phone).toContain('Projetos');
  const choices = [{kind:'photo' as const,id:1,label:'Fotografia #1',photo},{kind:'document' as const,id:2,label:'Documento'}];
  const picker = renderToStaticMarkup(<MailAttachmentPicker photosEnabled={false} choices={choices} setCategory={()=>{}} pick={()=>{}} cancel={()=>{}} draw={()=>{}}/>);
  expect(picker).not.toContain('Fotografias');
  expect(picker).toContain('Documentos');
  const composer = renderToStaticMarkup(<MailComposer photosEnabled={false} documentsEnabled={false} choices={[]} pending={false} error={null} fee={1.5} publish={()=>{}} back={()=>{}} close={()=>{}} draw={()=>{}}/>);
  expect(composer).not.toContain('Selecionar anexo');
  expect(composer).toContain('Publicar comunicado');
});
