import { expect, it } from 'vitest';
import { cleanFrame } from './clean-unit-sprites';
it('removes adjacent sprite fragments without removing detached props or the main body', () => {
  const w = 12,
    h = 10,
    data = new Uint8Array(w * h * 4);
  const pixel = (x: number, y: number, a = 255) => {
    data[(y * w + x) * 4 + 3] = a;
  };
  for (let y = 2; y < 8; y++) for (let x = 3; x < 9; x++) pixel(x, y);
  pixel(0, 3);
  pixel(1, 3); // neighboring frame
  pixel(5, 0); // detached prop
  pixel(2, 3, 3); // faint bridge must not join the neighbor
  cleanFrame(data, w, h);
  expect(data[3 * w * 4 + 3]).toBe(0);
  expect(data[(3 * w + 1) * 4 + 3]).toBe(0);
  expect(data[(3 * w + 5) * 4 + 3]).toBe(255);
  expect(data[5 * 4 + 3]).toBe(255);
});
