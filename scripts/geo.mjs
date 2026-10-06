// Geometria mínima para montar os bairros a partir do OpenStreetMap e localizar
// os locais de votação dentro deles. Sem dependências.

const chave = ([lon, lat]) => `${lon},${lat}`;

/**
 * Junta trechos de linha (cada um uma lista de [lon, lat]) em anéis fechados,
 * encadeando pelas pontas, invertendo trechos quando preciso. Trechos que não
 * fecham um anel são descartados e devolvidos em `soltos`.
 */
export function montarAneis(trechos) {
  const restantes = trechos.map((t) => [...t]);
  const aneis = [];
  const soltos = [];
  while (restantes.length) {
    let anel = restantes.shift();
    let fechou = chave(anel[0]) === chave(anel.at(-1));
    while (!fechou) {
      const fim = chave(anel.at(-1));
      const i = restantes.findIndex((t) => chave(t[0]) === fim || chave(t.at(-1)) === fim);
      if (i < 0) break;
      const [t] = restantes.splice(i, 1);
      const seguinte = chave(t[0]) === fim ? t : [...t].reverse();
      anel = anel.concat(seguinte.slice(1));
      fechou = chave(anel[0]) === chave(anel.at(-1));
    }
    (fechou ? aneis : soltos).push(anel);
  }
  return { aneis, soltos };
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
    geometria:
      poligonos.length === 1
        ? { type: 'Polygon', coordinates: poligonos[0] }
        : { type: 'MultiPolygon', coordinates: poligonos },
  };
}
