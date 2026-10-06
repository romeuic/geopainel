import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarProjecao } from '../src/projecao.js';

const quadrado = (lon, lat, lado) => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [lon, lat],
        [lon + lado, lat],
        [lon + lado, lat + lado],
        [lon, lat + lado],
        [lon, lat],
      ],
    ],
  },
});

test('a projeção ocupa a largura pedida e põe o norte em cima', () => {
  const col = { features: [quadrado(-57, -33, 1), quadrado(-50, -28, 1)] };
  const p = criarProjecao(col, 1000, 0);
  const d = p.caminho(col.features[1]);
  const ys = [...d.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1]));
  assert.equal(Math.min(...ys), 0);
  const xs = [...p.caminho(col.features[0]).matchAll(/[ML](-?[\d.]+)/g)].map((m) => Number(m[1]));
  assert.equal(Math.min(...xs), 0);
  assert.ok(p.altura > 0 && p.altura < 1000);
});

test('MultiPolygon gera um subcaminho por anel', () => {
  const a = quadrado(-52, -30, 0.1).geometry.coordinates;
  const b = quadrado(-51, -29, 0.1).geometry.coordinates;
  const f = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [a, b] } };
  const d = criarProjecao({ features: [f] }).caminho(f);
  assert.equal(d.match(/M/g).length, 2);
  assert.equal(d.match(/Z/g).length, 2);
});
