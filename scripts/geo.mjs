// Geometria mínima para montar os bairros a partir do OpenStreetMap e localizar
// os locais de votação dentro deles. Sem dependências.

const chave = ([lon, lat]) => `${lon},${lat}`;

// Vão máximo (graus, ~200 m) que montarAneis fecha com uma reta: relações do
// OSM às vezes têm um pedaço de divisa faltando (Fragata, em Pelotas: ~160 m).
export const VAO_MAX = 2e-3;

/**
 * Junta trechos de linha (cada um uma lista de [lon, lat]) em anéis fechados,
 * encadeando pelas duas pontas e invertendo trechos quando preciso. Uma cadeia
 * cujas pontas ficam a até VAO_MAX vira anel e conta em `remendados`; o que não
 * fecha volta em `soltos`.
 */
export function montarAneis(trechos) {
  const restantes = trechos.map((t) => [...t]);
  const aneis = [];
  const soltos = [];
  let remendados = 0;
  const fechado = (a) => chave(a[0]) === chave(a.at(-1));
  while (restantes.length) {
    let anel = restantes.shift();
    while (!fechado(anel)) {
      const fim = chave(anel.at(-1));
      const inicio = chave(anel[0]);
      let i = restantes.findIndex((t) => chave(t[0]) === fim || chave(t.at(-1)) === fim);
      if (i >= 0) {
        const [t] = restantes.splice(i, 1);
        anel = anel.concat((chave(t[0]) === fim ? t : [...t].reverse()).slice(1));
        continue;
      }
      i = restantes.findIndex((t) => chave(t[0]) === inicio || chave(t.at(-1)) === inicio);
      if (i < 0) break;
      const [t] = restantes.splice(i, 1);
      anel = (chave(t.at(-1)) === inicio ? t : [...t].reverse()).slice(0, -1).concat(anel);
    }
    if (!fechado(anel) && anel.length > 3) {
      const [[x0, y0], [x1, y1]] = [anel[0], anel.at(-1)];
      if (Math.hypot(x1 - x0, y1 - y0) <= VAO_MAX) {
        anel.push(anel[0]);
        remendados += 1;
      }
    }
    (fechado(anel) ? aneis : soltos).push(anel);
  }
  return { aneis, soltos, remendados };
}

/** Ponto dentro de um anel (ray casting). */
export function dentroDoAnel([x, y], anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Ponto dentro de uma geometria GeoJSON Polygon ou MultiPolygon (com buracos). */
export function dentro(ponto, geometria) {
  const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
  return poligonos.some(
    ([externo, ...buracos]) => dentroDoAnel(ponto, externo) && !buracos.some((b) => dentroDoAnel(ponto, b)),
  );
}

/**
 * Monta a geometria GeoJSON de uma relação do OSM (formato /relation/ID/full.json).
 * Anéis "inner" viram buracos do anel externo que os contém.
 */
export function geometriaDaRelacao(elementos) {
  const nos = new Map();
  const vias = new Map();
  let relacao;
  for (const e of elementos) {
    if (e.type === 'node') nos.set(e.id, [e.lon, e.lat]);
    else if (e.type === 'way') vias.set(e.id, e.nodes);
    else if (e.type === 'relation') relacao = e;
  }
  const trechosDe = (papel) =>
    relacao.members
      .filter((m) => m.type === 'way' && (m.role || 'outer') === papel)
      .map((m) => vias.get(m.ref).map((id) => nos.get(id)));
  const externos = montarAneis(trechosDe('outer'));
  const internos = montarAneis(trechosDe('inner'));
  const poligonos = externos.aneis.map((anel) => [anel]);
  for (const buraco of internos.aneis) {
    const dono = poligonos.find(([externo]) => dentroDoAnel(buraco[0], externo));
    if (dono) dono.push(buraco);
  }
  return {
    tags: relacao.tags,
    soltos: externos.soltos.length + internos.soltos.length,
    remendados: externos.remendados + internos.remendados,
    geometria:
      poligonos.length === 1
        ? { type: 'Polygon', coordinates: poligonos[0] }
        : { type: 'MultiPolygon', coordinates: poligonos },
  };
}
