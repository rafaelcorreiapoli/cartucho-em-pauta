import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createSnake,stepSnake,turnSnake,SNAKE_STEP_MS} from '../snake';
import {PhoneSnake} from './phone-snake';

test('the phone shows score and restart controls from the authoritative Snake state',()=>{
  const round = createSnake(0);
  const render = ()=>renderToStaticMarkup(<PhoneSnake game={round} available board={null} send={()=>{}}/>);
  expect(render()).toContain('Use as setas para começar');
  turnSnake(round,'right',0);
  for (let tick=1;tick<=3;tick++) stepSnake(round,tick*SNAKE_STEP_MS,()=>0);
  expect(render()).toContain('1 / 5 frutas');
  for (let tick=4;tick<=6;tick++) stepSnake(round,tick*SNAKE_STEP_MS,()=>0);
  expect(render()).toContain('Fim de jogo');
  expect(render()).toContain('aria-keyshortcuts="5">Jogar de novo');
});
