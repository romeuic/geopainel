import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AZUL, VERMELHO, cor, posicao, valorEm } from '../src/escala.js';

test('extremos da escala são exatamente azul-escuro e vermelho', () => {
  assert.equal(cor(0), AZUL);
  assert.equal(cor(1), VERMELHO);
  assert.equal(cor(-3), AZUL);
  assert.equal(cor(9), VERMELHO);
});

test('zero voto fica sempre no início da escala', () => {
  assert.equal(posicao(0, 9002, 'log'), 0);
  assert.equal(posicao(0, 9002, 'linear'), 0);
  assert.equal(posicao(5, 0), 0);
});

test('o máximo fica no fim da escala', () => {
  assert.equal(posicao(9002, 9002, 'log'), 1);
  assert.equal(posicao(9002, 9002, 'linear'), 1);
});

test('log afasta as cidades pequenas do azul mais que o linear', () => {
  assert.ok(posicao(100, 9002, 'log') > 0.4);
  assert.ok(posicao(100, 9002, 'linear') < 0.02);
});

test('valorEm é o inverso de posicao', () => {
  for (const escala of ['log', 'linear'])
    for (const v of [1, 37, 950, 9002]) assert.ok(Math.abs(valorEm(posicao(v, 9002, escala), 9002, escala) - v) < 1e-6);
});

test('com unidade, a escala log também espalha frações pequenas', () => {
  const max = 0.0149;
  const unidade = 0.0002;
  assert.ok(posicao(0.001, max, 'log') < 0.07); // sem unidade: praticamente linear
  assert.ok(posicao(0.001, max, 'log', unidade) > 0.4);
  assert.equal(posicao(max, max, 'log', unidade), 1);
  assert.ok(Math.abs(valorEm(posicao(0.003, max, 'log', unidade), max, 'log', unidade) - 0.003) < 1e-12);
});
