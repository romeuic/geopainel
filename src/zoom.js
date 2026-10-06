// Zoom e arraste do mapa como contas sobre o viewBox do SVG: a "vista" é o
// retângulo { x, y, w, h } do desenho que aparece na tela. Sem DOM, para testar.

export const ZOOM_MAX = 16;

const entre = (v, min, max) => Math.min(max, Math.max(min, v));

/** Vista inteira de um desenho largura × altura. */
export const vistaInteira = (largura, altura) => ({ x: 0, y: 0, w: largura, h: altura });

/** Quanto a vista está aproximada (1 = desenho inteiro). */
export const nivel = (vista, largura) => largura / vista.w;

/** Prende a vista ao desenho: zoom entre 1 e ZOOM_MAX, sem sair das bordas. */
export function limitar(vista, largura, altura) {
  const w = entre(vista.w, largura / ZOOM_MAX, largura);
  const h = (w * altura) / largura;
  return { x: entre(vista.x, 0, largura - w), y: entre(vista.y, 0, altura - h), w, h };
}

/**
 * Aproxima (fator > 1) ou afasta (fator < 1) mantendo o ponto (px, py) do
 * desenho parado na tela — o ponto sob o cursor ou o centro dos dedos.
 */
export function aproximar(vista, fator, [px, py], largura, altura) {
  const w = entre(vista.w / fator, largura / ZOOM_MAX, largura);
  const f = vista.w / w;
  return limitar(
    { x: px - (px - vista.x) / f, y: py - (py - vista.y) / f, w, h: (w * altura) / largura },
    largura,
    altura,
  );
}

/** Desloca a vista por (dx, dy) em unidades do desenho. */
export const deslocar = (vista, dx, dy, largura, altura) =>
  limitar({ ...vista, x: vista.x - dx, y: vista.y - dy }, largura, altura);
