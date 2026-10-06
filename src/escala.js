// Escala de cor do mapa: azul-escuro (0 votos) → vermelho nítido (máximo).
// A interpolação é feita em OKLab, que mantém o brilho subindo de forma
// uniforme em vez de passar por um roxo apagado como no RGB.

export const AZUL = '#0b1d51';
export const VERMELHO = '#ff1f1f';

const hexParaRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gama = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbParaOklab([r, g, b]) {
  [r, g, b] = [r, g, b].map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabParaRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, gama(c))));
}

const rgbParaHex = (rgb) =>
  '#' +
  rgb
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

const INICIO = rgbParaOklab(hexParaRgb(AZUL));
const FIM = rgbParaOklab(hexParaRgb(VERMELHO));

/** Cor para t em [0, 1]: 0 → AZUL, 1 → VERMELHO. */
export function cor(t) {
  const u = Math.min(1, Math.max(0, t));
  return rgbParaHex(oklabParaRgb(INICIO.map((v, i) => v + (FIM[i] - v) * u)));
}

/**
 * Posição de um valor na escala, em [0, 1].
 * 'log' usa log(1 + v/unidade), que mantém 0 em 0 e evita que a capital
 * deixe todo o resto do estado na mesma cor. `unidade` é o menor valor
 * positivo da medida: 1 para contagem de votos; para frações (proporção,
 * percentual) sem ela log(1 + v) ≈ v e a escala viraria linear.
 */
export function posicao(valor, maximo, escala = 'log', unidade = 1) {
  if (!(maximo > 0) || !(valor > 0)) return 0;
  const t = escala === 'log' ? Math.log1p(valor / unidade) / Math.log1p(maximo / unidade) : valor / maximo;
  return Math.min(1, t);
}

/** Inverso de posicao(): o valor que fica na posição t. */
export function valorEm(t, maximo, escala = 'log', unidade = 1) {
  if (!(maximo > 0)) return 0;
  return escala === 'log' ? unidade * Math.expm1(t * Math.log1p(maximo / unidade)) : t * maximo;
}
