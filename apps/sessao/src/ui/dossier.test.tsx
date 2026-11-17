import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {stations} from '../plenary';
import {Dossier,canPublishEvidence,dossierModel} from './dossier';

test('the dossier keeps evidence private until a nearby offer clears and the buyer reaches the press',()=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    id:nick,nick,character,x:140+character*10,y:146,direction:0,moving:false,
  }));
  const [rafa,bia,caio] = players;
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  expect(match.start(rafa.id,players,0,()=>.9)).toBe(true);
  const view = (player:Player,now:number,people:Player[])=>match.view(player.id,ids,now,match.contacts(player,people));
  const render = (player:Player,now:number,people=players,visible=people)=>{
    const model = dossierModel(player.id,view(player,now,people),visible)!;
    return renderToStaticMarkup(<Dossier model={model} send={()=>{}} close={()=>{}}/>);
  };
  match.politics({...rafa,...stations.cabinet},{kind:'grant',diverted:3},players,1);
  match.act({...bia,...stations.audit},'audit',2);
  const proof = view(bia,2,players).politics!.evidence[0];
  expect(render(bia,2)).toContain('Rafa desviou R$ 30 mil');
  expect(render(bia,2)).toContain('data-skin="2"');
  expect(render(bia,2,players,[rafa,bia])).not.toContain('data-skin="2"');
  expect(render(caio,2)).toContain('Nenhuma prova no dossiê');
  expect(render(caio,2)).toContain('aria-label="Fechar dossiê"');
  expect(render(caio,2)).toContain('type="button" class="hud-icon-button" aria-label="Fechar dossiê"');
  expect(render(caio,2)).toContain('href="#icon-cross"');
  match.politics(bia,{kind:'share',to:caio.id,evidence:proof.id,price:2},players,3);
  const offer = view(caio,3,players).politics!.incoming[0];
  expect(render(caio,3)).toContain('Bia oferece um documento por R$ 20 mil');
  expect(render(caio,3)).not.toContain('Rafa desviou');
  expect(render(rafa,3)).not.toContain('Bia oferece');
  const distant = {...caio,x:450};
  const separated = [rafa,bia,distant];
  expect(render(distant,3,separated)).toContain('disabled="">Comprar');
  match.politics(distant,{kind:'accept',offer:offer.id},separated,4);
  expect(view(caio,4,players).politics!.evidence).toHaveLength(0);
  match.politics(caio,{kind:'accept',offer:offer.id},players,5);
  expect(render(caio,5)).toContain(`Documento ${proof.id} · Rodada 1`);
  expect(render(caio,5)).toContain('disabled="">Divulgar na imprensa');
  match.politics(caio,{kind:'publish',evidence:proof.id},players,6);
  expect(view(rafa,6,players).politics!.ledger).toHaveLength(0);
  const press = {...caio,...stations.press};
  expect(canPublishEvidence(view(press,7,players),press)).toBe(true);
  expect(render(press,7,[rafa,bia,press])).toContain('type="button">Divulgar na imprensa');
  match.politics(press,{kind:'publish',evidence:proof.id},players,8);
  expect(view(rafa,8,players).politics!.ledger).toContainEqual(proof);
  expect(render(press,8,[rafa,bia,press])).not.toContain(`Documento ${proof.id} · Rodada 1`);
});
