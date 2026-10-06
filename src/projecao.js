// Projeção equirretangular com correção de cosseno na latitude média: para um
// recorte do tamanho do RS a distorção é desprezível e dispensa bibliotecas.

function* pontos(geometria) {
  const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
  for (const poligono of poligonos) for (const anel of poligono) yield* anel;
}

/**
 * Cria a projeção para um FeatureCollection, ajustada a `largura` unidades de
 * SVG. Devolve { largura, altura, caminho(feature), ponto([lon, lat]) }.
 */
export function criarProjecao(colecao, largura = 1000, margem = 8) {
  let [oeste, sul, leste, norte] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of colecao.features)
    for (const [lon, lat] of pontos(f.geometry)) {
      if (lon < oeste) oeste = lon;
      if (lon > leste) leste = lon;
      if (lat < sul) sul = lat;
      if (lat > norte) norte = lat;
    }

  const k = Math.cos((((sul + norte) / 2) * Math.PI) / 180);
  const escala = (largura - 2 * margem) / ((leste - oeste) * k);
  const altura = Math.ceil((norte - sul) * escala + 2 * margem);
  const x = (lon) => (margem + (lon - oeste) * k * escala).toFixed(1);
  const y = (lat) => (margem + (norte - lat) * escala).toFixed(1);

  function caminho(feature) {
    const g = feature.geometry;
    const poligonos = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    let d = '';
    for (const poligono of poligonos)
      for (const anel of poligono) d += 'M' + anel.map(([lon, lat]) => x(lon) + ',' + y(lat)).join('L') + 'Z';
    return d;
  }

  /** [lon, lat] → [x, y] no mesmo sistema do SVG. */
  const ponto = ([lon, lat]) => [Number(x(lon)), Number(y(lat))];

  return { largura, altura, caminho, ponto };
}
