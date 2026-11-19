import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {BudgetMeter,ParliamentMetrics} from './hud';
import {createHudModel} from './hud-model';
import {LobbyControls,lobbyControlsState} from './lobby-controls';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {SessionResult} from '../results';
import {caloteRules,publicBudgetLabel} from '../game-modes';

const commands = {changeNpcCount:()=>{},start:()=>{},back:()=>{}};

test.each([
  [16,'positive',50,25],[-16,'negative',25,25],[0,'zero',50,0],
  [100,'positive',50,50],[-100,'negative',0,50],
] as const)('budget %s fills only its side of the centered scale',(budget,direction,left,width)=>{
  const html = renderToStaticMarkup(<BudgetMeter budget={budget}/>);
  expect(html).toContain(`data-direction="${direction}"`);
  expect(html).toContain(`left:${left}%;width:${width}%`);
  expect(html).toContain('calote-budget-center');
  expect(html).toContain(`aria-valuemin="-${caloteRules.budgetMeterLimit}"`);
  expect(html).toContain(publicBudgetLabel(budget));
});

test('calote HUD replaces stability, keeps the session clock and shows the server countdown only in debt',()=>{
  const html = renderToStaticMarkup(<ParliamentMetrics gameMode="calote" stability={0} budget={-3} sessionRemaining={90} caloteIn={17}/>);
  expect(html).not.toContain('stabilidade');
  expect(html).not.toContain('Estabilidade');
  expect(html).toContain('Orçamento público');
  expect(html).toContain('Tempo até o calote');
  expect(html).toContain('17 s');
  expect(html).toContain('1:30');
  expect(html).not.toContain('calote-budget-zero');
  const positive = renderToStaticMarkup(<ParliamentMetrics gameMode="calote" stability={0} budget={0} caloteIn={30}/>);
  expect(positive).not.toContain('Tempo até o calote');
  expect(renderToStaticMarkup(<ParliamentMetrics stability={48} budget={0}/>)).toContain('Estabilidade institucional');
});

test('HUD subscriptions include the mode and countdown, and clear them when returning to classic',()=>{
  const match = new PlenaryMatch(1);
  const hud = createHudModel();
  const view = match.view('a',['a'],0);
  hud.render({...view,gameMode:'calote',budget:-1,caloteIn:30});
  expect(hud.congress.get()).toMatchObject({gameMode:'calote',caloteIn:30});
  hud.render({...view,gameMode:'calote',budget:-1,caloteIn:29});
  expect(hud.congress.get().caloteIn).toBe(29);
  hud.render({...view,gameMode:'classic'});
  expect(hud.congress.get().caloteIn).toBeUndefined();
});

test('host and guests see the selected game mode, and only the host can select it',()=>{
  const match = new PlenaryMatch(6);
  const view = {...match.view('a',['a','b'],0),gameMode:'calote' as const};
  const html = (id:string)=>renderToStaticMarkup(<LobbyControls state={lobbyControlsState(view,id,true)} commands={commands}/>);
  expect(html('a')).toContain('aria-label="Modo de jogo"');
  expect(html('a')).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Calote<\/button>/);
  expect(html('b')).toMatch(/<button[^>]*aria-pressed="true"[^>]*disabled=""[^>]*>Calote<\/button>/);
});

test('calote loss uses a fiscal result instead of claiming the building was destroyed',()=>{
  const html = renderToStaticMarkup(<SessionResult gameMode="calote" winner="Infiltrado" stability={48} reason="Orçamento negativo por 30 segundos."/>);
  expect(html).toContain('O Congresso deu calote!');
  expect(html).not.toContain('foi destruído');
});
