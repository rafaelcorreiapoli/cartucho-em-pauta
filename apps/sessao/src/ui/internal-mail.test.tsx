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
  const view = {available:[entry],history:[entry]};
  const bulletin = renderToStaticMarkup(<ComplaintDesk view={view} photos={[]}/>);
  expect(bulletin).toContain('Agressão confirmada · Bia · Com foto');
  expect(bulletin).not.toContain('Denunciar');
  const desk = renderToStaticMarkup(<ComplaintDesk view={view} photos={[{id:7,label:'Fotografia #7'}]} submit={()=>{}}/>);
  expect(desk).toContain('Fotografia #7');
  expect(desk).toContain('Denunciar');
});
