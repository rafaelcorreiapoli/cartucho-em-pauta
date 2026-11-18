import {expect,test} from 'bun:test';
import {Client,type Room} from '@colyseus/sdk';
import {join} from 'node:path';
import type {PlenaryView} from '../src/plenary';
import {tutorialSteps} from '../src/tutorial';
import {PlenaryMatch} from './PlenaryMatch';

test('training stays open and rejects projects and cassations',()=>{
  const match = new PlenaryMatch(1);
  match.training = true;
  const player = {id:'learner',nick:'Aprendiz',character:0,x:140,y:146,direction:0,moving:false};
  expect(match.start(player.id,[player],0)).toBe(true);
  match.advance(100_000_000);
  expect(match.phase).toBe('negotiation');
  expect(match.canHandleObjects(player.id,100_000_000)).toBe(true);
  expect(match.callCassation(player,100_000_000)).toContain('tutorial');
  expect(match.gameplayWorld([player],100_000_000,()=>true).projectFilingError?.(player.id,0)).toContain('tutorial');
});

test('tutorial rooms isolate learners, validate progress and prepare repeatable chapters',async()=>{
  const reservation = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response()});
  const port = reservation.port!;
  await reservation.stop();
  const server = Bun.spawn([process.execPath,join(import.meta.dir,'index.ts')],{
    env:{...process.env,PORT:String(port),NODE_ENV:'test'},stdout:'ignore',stderr:'inherit',
  });
  let room:Room|undefined;
  try {
    const endpoint = 'http://127.0.0.1:'+port;
    for (let i=0;i<60;i++) {
      if (await fetch(endpoint+'/health').then(r=>r.ok).catch(()=>false)) break;
      await Bun.sleep(50);
    }
    room = await new Client(endpoint).create('plenary',{nick:'Aprendiz',tutorial:true});
    let view:PlenaryView|undefined;
    room.onMessage('plenary',(next:PlenaryView)=>{view=next;});
    room.onMessage('players',()=>{});
    room.onMessage('control',()=>{});
    const waitFor = async(predicate:()=>boolean)=>{
      for (let i=0;i<100;i++) {if (predicate()) return;await Bun.sleep(30);}
      throw Error('Tutorial did not reach expected state. '+JSON.stringify(view?.tutorial));
    };
    await expect(new Client(endpoint).joinById(room.roomId,{nick:'Intruso'})).rejects.toThrow();
    room.send('start-match',{token:1});
    await waitFor(()=>view?.phase==='negotiation');
    expect(view?.tutorial?.step).toBe(0);
    expect(view?.players).toBeGreaterThan(1);
    room.send('tutorial','next');
    await waitFor(()=>view?.tutorial?.step===1);
    room.send('tutorial','next');
    await Bun.sleep(100);
    expect(view?.tutorial?.step).toBe(1);
    const equipment = tutorialSteps.findIndex(step=>step.event==='equipped');
    room.send('tutorial','step:'+equipment);
    await waitFor(()=>view?.tutorial?.step===equipment && !!view.gameplay?.inventory.some(item=>item.kind==='binoculars'));
    const item = view!.gameplay!.inventory.find(item=>item.kind==='binoculars')!;
    room.send('gameplay',{token:2,action:{kind:'equip',item:item.id}});
    await waitFor(()=>view?.tutorial?.step===equipment+1);
    room.send('tutorial','step:'+tutorialSteps.findIndex(step=>step.event==='fire-extinguished'));
    await waitFor(()=>!!view?.fire);
    room.send('tutorial','step:'+tutorialSteps.findIndex(step=>step.event==='power-repaired'));
    await waitFor(()=>!!view?.outage);
    room.send('tutorial','skip');
    await waitFor(()=>view?.tutorial?.complete===true);
    room.send('tutorial','restart');
    await waitFor(()=>view?.tutorial?.step===0 && !view.tutorial.complete);
    expect(view?.project).toBeUndefined();
  } finally {
    await room?.leave();
    server.kill();
    await server.exited;
  }
},15_000);
