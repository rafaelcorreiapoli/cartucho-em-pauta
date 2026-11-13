import {expect,test} from 'bun:test';
import {monitoredChannel,type SpyView} from './surveillance';

test('the monitoring panel switches between camera and grampo',()=>{
  const view:SpyView = {channels:[
    {id:1,name:'Câmera',room:'Biblioteca',kind:'spyCamera',alerts:true,active:false,removed:false},
    {id:2,name:'Grampo',room:'Cafezinho',kind:'wiretap',alerts:true,active:false,removed:false},
  ],options:[],muted:false};
  expect(monitoredChannel({...view,selected:1})?.kind).toBe('spyCamera');
  expect(monitoredChannel({...view,audio:2})?.kind).toBe('wiretap');
  expect(monitoredChannel(view)).toBeUndefined();
});
