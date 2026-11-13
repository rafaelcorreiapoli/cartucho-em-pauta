import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Attachment} from './internal-mail';

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
