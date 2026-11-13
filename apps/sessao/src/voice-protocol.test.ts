import {expect,test} from 'bun:test';
import {showsSpeakerIdentity} from './voice-protocol';

test('global megaphone and surveillance never light the speaker badge',()=>{
  expect(showsSpeakerIdentity(['speaker',.85,false,true])).toBe(false);
  expect(showsSpeakerIdentity(['speaker',.85,true,true])).toBe(false);
  expect(showsSpeakerIdentity(['speaker',.6,false])).toBe(false);
  expect(showsSpeakerIdentity(['speaker',.8,true])).toBe(true);
  expect(showsSpeakerIdentity(['speaker',0,true])).toBe(false);
});
