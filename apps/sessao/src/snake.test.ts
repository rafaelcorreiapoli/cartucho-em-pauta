import { expect, test } from 'bun:test';
import { createSnake, SNAKE_GOAL, SNAKE_SIZE, SNAKE_STEP_MS, stepSnake, turnSnake } from './snake';

test('Snake accepts one legal turn per step and rejects reversing', () => {
  const round = createSnake(0);
  const head = round.body[0];
  turnSnake(round,'left',0);
  expect(round.status).toBe('ready');
  turnSnake(round,'right',0);
  stepSnake(round,SNAKE_STEP_MS-1);
  expect(round.body[0]).toBe(head);
  stepSnake(round,SNAKE_STEP_MS);
  turnSnake(round,'down',SNAKE_STEP_MS);
  turnSnake(round,'left',SNAKE_STEP_MS);
  stepSnake(round,2*SNAKE_STEP_MS);
  expect(round.body[0]).toBe(head+1+SNAKE_SIZE);
});

test('fruit grows the snake, respawns outside its body and completes the goal', () => {
  const round = createSnake(0);
  turnSnake(round,'right',0);
  for (let index=1;index<=3;index++) stepSnake(round,index*SNAKE_STEP_MS,()=>0);
  expect(round.score).toBe(1);
  expect(round.body).toHaveLength(4);
  expect(round.body).not.toContain(round.food);
  round.score = SNAKE_GOAL-1;
  round.food = round.body[0]+1;
  stepSnake(round,4*SNAKE_STEP_MS);
  expect(round.status).toBe('won');
  expect(round.food).toBe(-1);
});

test('the board ends the round on a wall or body collision', () => {
  const wall = createSnake(0);
  turnSnake(wall,'right',0);
  for (let index=1;index<=6;index++) stepSnake(wall,index*SNAKE_STEP_MS,()=>0);
  expect(wall.status).toBe('lost');

  const body = createSnake(0);
  body.body = [25,24,12,13,14];
  turnSnake(body,'up',0);
  stepSnake(body,SNAKE_STEP_MS);
  expect(body.status).toBe('lost');
});
