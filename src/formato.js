const inteiro = new Intl.NumberFormat('pt-BR');
const percentual = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const votos = (n) => inteiro.format(Math.round(n));
export const pct = (n) => percentual.format(n) + '%';
const fracao = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 3 });
// Medida "A cada 100": quantos eleitores a cada 100 (0 a 100), com 3 algarismos significativos.
export const proporcao = (n) => fracao.format(n);

const SIGLAS = { PCDOB: 'PCdoB' };
export const partido = (sigla) => SIGLAS[sigla] ?? sigla;

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
export const nomeProprio = (s) =>
  s
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');

export const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Nome de exibição: candidatura pelo nome de urna; legenda pelo partido.
// Nome de exibição: candidatura pelo nome de urna; legenda pelo partido;
// brancos, nulos e ausentes (partido "N/A") pelo próprio nome.
export const titulo = (c) =>
  c.tipo === 'legenda'
    ? `Votos na legenda ${partido(c.partido)}`
    : c.tipo === 'especial'
      ? c.nomeUrna
      : nomeProprio(c.nomeUrna);

// Complemento para frases como "o mapa com …".
export const descricao = (c) =>
  c.tipo === 'legenda'
    ? `os votos na legenda do ${partido(c.partido)}`
    : c.tipo === 'especial'
      ? `os ${c.nomeUrna.toLowerCase()}`
      : `os votos de ${nomeProprio(c.nomeUrna)}`;

// "1 voto", "3 votos"; para ausentes, "eleitor(es)".
export const contagem = (c, n) =>
  c.numero === 'ausentes' ? (n === 1 ? 'eleitor' : 'eleitores') : n === 1 ? 'voto' : 'votos';
