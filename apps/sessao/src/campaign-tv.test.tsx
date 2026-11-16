import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../server/PlenaryMatch';
import {CampaignTv} from './campaign-tv';
import {stations} from './plenary';
import type {Player} from './map';

test('the campaign TV displays the authorized ad using the viewer’s side and motion preference',()=>{
  const candidate:Player = {id:'a',nick:'Bia',character:2,x:0,y:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(candidate.id,[candidate],0,()=>.9)).toBe(true);
  expect(match.electionAction(candidate,{kind:'advertise'},1,false)).toBeUndefined();
  const advertisement = match.electionAction({...candidate,...stations.press},{kind:'advertise'},2,false);
  expect(advertisement).toMatchObject({name:'Bia',character:2});
  if (!advertisement) throw new Error('Expected the server to authorize the ad');

  const ad = {...advertisement,advertiserId:candidate.id};
  const own = renderToStaticMarkup(<CampaignTv ad={ad} localPlayerId="a" sequence={1} reducedMotion={false}/>);
  expect(own).toContain('data-side="left"');
  expect(own).toContain('data-skin="2"');
  expect(own).toContain(`<span>Vote Bia</span><strong>${ad.number}</strong>`);
  expect(own).toContain(`Propaganda eleitoral. Vote Bia, número ${ad.number}.`);
  const remote = renderToStaticMarkup(<CampaignTv ad={ad} localPlayerId="b" sequence={1} reducedMotion/>);
  expect(remote).toContain('data-side="right"');
  expect(remote).toContain('animation-duration:0ms');
  const idle = renderToStaticMarkup(<CampaignTv localPlayerId="b" sequence={2} reducedMotion/>);
  expect(idle).not.toContain('campaign-tv-screen');
  expect(idle).toContain('role="status"');
});
