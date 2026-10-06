import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comTotais, idTotal, votosNaCidade } from '../src/totais.js';

const opcao = (numero, partido, base, municipios) => ({
  numero,
  partido,
  base,
  votos: Object.values(municipios).reduce((s, m) => s + m.votos, 0),
  municipios,
});

const cargo = {
  codigo: 'federal',
  nome: 'Deputado Federal',
  municipios: {
    1: { eleitores: 100, comparecimento: 80, validos: 70 },
    2: { eleitores: 50, comparecimento: 40, validos: 35 },
  },
  candidatos: [
    opcao('1330', 'PT', 'validos', { 1: { votos: 7 }, 2: { votos: 1 } }),
    opcao('1307', 'PT', 'validos', { 1: { votos: 7 } }),
    opcao('13', 'PT2', 'validos', { 1: { votos: 3 } }), // grupo de 1: sem total
    opcao('brancos', 'N/A', 'votos', { 1: { votos: 4 }, 2: { votos: 2 } }),
    opcao('ausentes', 'N/A', 'eleitores', { 1: { votos: 20 }, 2: { votos: 10 } }),
  ],
};

test('total só para grupos partido + cargo com 2+ opções, no fim do grupo', () => {
  const [c] = comTotais([cargo]);
  assert.deepEqual(
    c.candidatos.map((x) => x.numero),
    ['1330', '1307', idTotal('PT'), '13', 'brancos', 'ausentes', idTotal('N/A')],
  );
});

test('total soma votos por município e recalcula o percentual na base comum', () => {
  const [c] = comTotais([cargo]);
  const pt = c.candidatos.find((x) => x.numero === idTotal('PT'));
  assert.equal(pt.votos, 15);
  assert.equal(pt.base, 'validos');
  assert.deepEqual(pt.municipios[1], { votos: 14, pct: 20 });
  assert.equal(pt.pct, (15 / 105) * 100);
  assert.deepEqual(pt.componentes, ['1330', '1307']);
});

test('bases diferentes (N/A) caem no eleitorado', () => {
  const [c] = comTotais([cargo]);
  const na = c.candidatos.find((x) => x.numero === idTotal('N/A'));
  assert.equal(na.base, 'eleitores');
  assert.deepEqual(na.municipios[2], { votos: 12, pct: 24 });
});

test('votosNaCidade soma os componentes do total por área', () => {
  const votos = { 1330: { centro: 2, norte: 1 }, 1307: { centro: 5 } };
  assert.deepEqual(votosNaCidade({ numero: 'x', componentes: ['1330', '1307'] }, votos), { centro: 7, norte: 1 });
  assert.deepEqual(votosNaCidade({ numero: '1330' }, votos), { centro: 2, norte: 1 });
});
