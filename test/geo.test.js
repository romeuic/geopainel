import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dentro, geometriaDaRelacao, montarAneis } from '../scripts/geo.mjs';

test('montarAneis encadeia trechos fora de ordem e invertidos', () => {
  const { aneis, soltos } = montarAneis([
    [
      [0, 0],
      [1, 0],
    ],
    [
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    [
      [1, 1],
      [1, 0],
    ], // invertido
  ]);
  assert.equal(soltos.length, 0);
  assert.equal(aneis.length, 1);
  assert.equal(aneis[0].length, 5);
  assert.deepEqual(aneis[0][0], aneis[0].at(-1));
});

test('trecho que não fecha vai para soltos', () => {
  const { aneis, soltos } = montarAneis([
    [
      [0, 0],
      [1, 0],
    ],
  ]);
  assert.equal(aneis.length, 0);
  assert.equal(soltos.length, 1);
});

test('dentro respeita buracos', () => {
  const quadrado = (a, b) => [
    [a, a],
    [b, a],
    [b, b],
    [a, b],
    [a, a],
  ];
  const g = { type: 'Polygon', coordinates: [quadrado(0, 10), quadrado(4, 6)] };
  assert.ok(dentro([2, 2], g));
  assert.ok(!dentro([5, 5], g)); // no buraco
  assert.ok(!dentro([12, 5], g));
});

test('geometriaDaRelacao monta polígono com buraco a partir do OSM', () => {
  const no = (id, lon, lat) => ({ type: 'node', id, lon, lat });
  const elementos = [
    no(1, 0, 0),
    no(2, 10, 0),
    no(3, 10, 10),
    no(4, 0, 10),
    no(5, 4, 4),
    no(6, 6, 4),
    no(7, 6, 6),
    no(8, 4, 6),
    { type: 'way', id: 10, nodes: [1, 2, 3] },
    { type: 'way', id: 11, nodes: [3, 4, 1] },
    { type: 'way', id: 12, nodes: [5, 6, 7, 8, 5] },
    {
      type: 'relation',
      id: 99,
      tags: { name: 'Teste' },
      members: [
        { type: 'way', ref: 10, role: 'outer' },
        { type: 'way', ref: 11, role: 'outer' },
        { type: 'way', ref: 12, role: 'inner' },
      ],
    },
  ];
  const r = geometriaDaRelacao(elementos);
  assert.equal(r.tags.name, 'Teste');
  assert.equal(r.soltos, 0);
  assert.equal(r.geometria.type, 'Polygon');
  assert.equal(r.geometria.coordinates.length, 2);
  assert.ok(dentro([1, 1], r.geometria));
  assert.ok(!dentro([5, 5], r.geometria));
});

test('montarAneis emenda pelas duas pontas e fecha vão pequeno', () => {
  // Trechos em ordem "de trás para frente" e um vão de ~3 m entre as pontas.
  const { aneis, soltos, remendados } = montarAneis([
    [
      [1, 1],
      [0, 1],
      [0, 0.00002],
    ],
    [
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
    ],
  ]);
  assert.equal(soltos.length, 0);
  assert.equal(aneis.length, 1);
  assert.equal(remendados, 1);
  assert.deepEqual(aneis[0][0], aneis[0].at(-1));
});

test('vão grande não é fechado', () => {
  const { aneis, soltos } = montarAneis([
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0.5],
    ],
  ]);
  assert.equal(aneis.length, 0); // vão de 0,5° (~50 km)
  assert.equal(soltos.length, 1);
});
