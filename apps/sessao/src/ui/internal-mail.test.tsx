import {PlenaryMatch} from '../../server/PlenaryMatch';
import {complaintRules} from '../complaints';
import type {Photo} from '../photography';
import type {Player} from '../map';
import {stations} from '../plenary';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Attachment,ComplaintDesk,ForwardedNotice} from './internal-mail';

const document = {id:3,title:'Auxílio Churrasco',signatures:['Rafa']};

test.each([[true,'VERDADEIRO','FALSO'],[false,'FALSO','VERDADEIRO']] as const)(
  'the mail shows the forensic verdict %s alongside the analyzed document',
  (authentic,expected,unexpected)=>{
    const html = renderToStaticMarkup(<Attachment draw={()=>{}} attachment={{
      kind:'report',report:{notice:7,document,authentic},
    }}/>);
    expect(html).toContain(expected);
    expect(html).not.toContain(unexpected);
    expect(html).toContain('Comunicado #7');
    expect(html).toContain(document.title);
    expect(html).toContain('Rafa');
  },
);

test('the mail renders a photo attachment in a canvas with its photo number',()=>{
  const photo = {id:9,at:0,author:{id:'rafa',name:'Rafa'},center:{x:0,y:0},selfie:true,location:'Corregedoria',
    people:[],ground:[],decorations:[],transfers:[]};
  const html = renderToStaticMarkup(<Attachment draw={()=>{}} attachment={{kind:'photo',photo}}/>);
  expect(html).toContain('<canvas');
  expect(html).toContain('Fotografia #9');
});


test('the Correio identifies a forwarded notice by its original number',()=>{
  const notice = {id:9,author:'Bia',subject:'Enc: Proposta',body:'Segue a proposta'};
  expect(renderToStaticMarkup(<ForwardedNotice notice={{...notice,forwardedFrom:4}}/>)).toContain('comunicado #4');
  expect(renderToStaticMarkup(<ForwardedNotice notice={notice}/>)).toBe('');
});

test('the public bulletin shows the confirmed offense but hides the filing controls',()=>{
  const entry = {id:2,kind:'hit' as const,accused:'Bia',at:10,hasPhoto:true as const};
  const view = {available:[{...entry,photoIds:[7]}],history:[entry]};
  const bulletin = renderToStaticMarkup(<ComplaintDesk view={view}/>);
  expect(bulletin).toContain('Agressão confirmada · Bia · Com foto');
  expect(bulletin).not.toContain('Denunciar');
  const desk = renderToStaticMarkup(<ComplaintDesk view={view} submit={()=>{}}/>);
  expect(desk).toContain('Fotografia #7');
  expect(desk).toContain('Denunciar');
});

test('only a photo accepted by the Corregedoria appears on the corresponding complaint',()=>{
  const [victim,accused,bystander]:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    id:nick,nick,character,direction:0,moving:false,...stations.audit,
  }));
  const players = [victim,accused,bystander];
  const match = new PlenaryMatch(1);
  expect(match.start(victim.id,players,100,()=>.9)).toBe(true);
  const incident = match.gameplayWorld(players,110,()=>false);
  expect(incident.publish({type:'hit',actor:accused.id,target:victim.id,position:stations.audit,at:110,witnesses:[]})).toBe(true);
  const subject = {...accused,name:accused.nick};
  const photo:Photo = {id:7,author:{id:victim.id,name:victim.nick},at:10,location:'Corregedoria',selfie:false,
    center:stations.audit,people:[subject],ground:[],decorations:[],transfers:[]};
  const wrongPerson = {...photo,id:8,people:[{...bystander,name:bystander.nick}]};
  const tooFar = {...photo,id:9,people:[{...subject,x:subject.x+complaintRules.photoDistance+1}]};
  const tooLate = {...photo,id:10,at:photo.at+complaintRules.photoWindowMs+1};
  const album = [photo,wrongPerson,tooFar,tooLate];
  const view = match.complaintView(victim.id,album);
  expect(view.available[0].photoIds).toEqual([7]);
  expect(match.complaintView(bystander.id,album).available).toEqual([]);
  const markup = renderToStaticMarkup(<ComplaintDesk view={view} submit={()=>{}}/>);
  expect(markup).toContain('Fotografia #7');
  for (const invalid of album.slice(1)) {
    expect(markup).not.toContain(`Fotografia #${invalid.id}`);
    expect(match.submitComplaint(victim,view.available[0].id,120,invalid)).toContain('incompatível');
  }
  expect(match.submitComplaint(victim,view.available[0].id,120,photo)).toBeUndefined();
  expect(match.complaintView(bystander.id).history[0]).toMatchObject({id:view.available[0].id,hasPhoto:true});
  expect(match.complaintView(bystander.id).history[0]).not.toHaveProperty('photoIds');
});
