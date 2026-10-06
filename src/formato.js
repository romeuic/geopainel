const inteiro = new Intl.NumberFormat('pt-BR');
const percentual = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const votos = (n) => inteiro.format(Math.round(n));
export const pct = (n) => percentual.format(n) + '%';

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
