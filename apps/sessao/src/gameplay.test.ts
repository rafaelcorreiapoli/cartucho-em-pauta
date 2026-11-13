import {expect,test} from 'bun:test';
import {canVerifyDocumentAt,readGameplayAction} from './gameplay';

test('document verification is offered only at the two document counters',()=>{
  expect(canVerifyDocumentAt('secretary')).toBe(true);
  expect(canVerifyDocumentAt('protocol')).toBe(true);
  expect(canVerifyDocumentAt('archive')).toBe(false);
  expect(canVerifyDocumentAt(undefined)).toBe(false);
  expect(readGameplayAction({kind:'verify-document',item:7,place:'secretary'}))
    .toMatchObject({kind:'verify-document',item:7,place:'secretary'});
});
