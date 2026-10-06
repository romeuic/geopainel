import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZOOM_MAX, aproximar, deslocar, limitar, nivel, vistaInteira } from '../src/zoom.js';

const L = 1000;
const A = 800;

test('aproximar mantém parado o ponto sob o cursor', () => {
  const v = aproximar(vistaInteira(L, A), 2, [250, 200], L, A);
  assert.deepEqual(v, { x: 125, y: 100, w: 500, h: 400 });
  assert.equal(nivel(v, L), 2);
  // 250 estava a 25% da largura e continua a 25% da vista nova
  assert.equal((250 - v.x) / v.w, 0.25);
});

test('zoom fica entre 1 e ZOOM_MAX', () => {
  assert.deepEqual(aproximar(vistaInteira(L, A), 0.5, [500, 400], L, A), vistaInteira(L, A));
  const muito = aproximar(vistaInteira(L, A), 1000, [500, 400], L, A);
  assert.equal(nivel(muito, L), ZOOM_MAX);
});

test('a vista não sai do desenho', () => {
  const v = aproximar(vistaInteira(L, A), 4, [500, 400], L, A);
  assert.deepEqual(deslocar(v, 10_000, 10_000, L, A), { x: 0, y: 0, w: 250, h: 200 });
  assert.deepEqual(deslocar(v, -10_000, -10_000, L, A), { x: 750, y: 600, w: 250, h: 200 });
  assert.deepEqual(limitar({ x: -5, y: -5, w: 2000, h: 9 }, L, A), vistaInteira(L, A));
});

test('sem zoom, arrastar não move', () => {
  assert.deepEqual(deslocar(vistaInteira(L, A), 50, 30, L, A), vistaInteira(L, A));
});
