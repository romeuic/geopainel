// Leitor mínimo de shapefile (polígonos) + dBASE, o bastante para a malha de
// bairros do IBGE. Sem dependências.

import { dentroDoAnel } from './geo.mjs';

// Área com sinal: positiva = sentido horário, que no shapefile é anel externo.
const areaComSinal = (anel) => {
  let a = 0;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++)
    a += (anel[j][0] + anel[i][0]) * (anel[j][1] - anel[i][1]);
  return a / 2;
};

/** Registros de um .dbf como objetos { campo: texto }. */
export function lerDbf(buf, codificacao = 'utf-8') {
  const total = buf.readUInt32LE(4);
  const tamCabecalho = buf.readUInt16LE(8);
  const tamRegistro = buf.readUInt16LE(10);
  const campos = [];
  for (let p = 32; buf[p] !== 0x0d; p += 32)
    campos.push({ nome: buf.toString('latin1', p, p + 11).replace(/\0.*$/, ''), tam: buf[p + 16] });
  const texto = new TextDecoder(codificacao);
  const registros = [];
  for (let i = 0; i < total; i++) {
    let p = tamCabecalho + i * tamRegistro + 1; // 1º byte: marca de apagado
    const r = {};
    for (const { nome, tam } of campos) {
      r[nome] = texto.decode(buf.subarray(p, p + tam)).trim();
      p += tam;
    }
    registros.push(r);
  }
  return registros;
}

/**
 * Geometrias de um .shp de polígonos (tipo 5) como GeoJSON Polygon/MultiPolygon.
 * Anéis horários são externos; anti-horários, buracos do externo que os contém.
 */
export function lerShp(buf) {
  const geometrias = [];
  let p = 100;
  while (p < buf.length) {
    const tam = buf.readInt32BE(p + 4) * 2;
    const r = p + 8;
    const tipo = buf.readInt32LE(r);
    if (tipo === 0) geometrias.push(null);
    else if (tipo !== 5) throw new Error(`Tipo de shape ${tipo} não suportado (só polígonos).`);
    else {
      const nPartes = buf.readInt32LE(r + 36);
      const nPontos = buf.readInt32LE(r + 40);
      const partes = Array.from({ length: nPartes }, (_, i) => buf.readInt32LE(r + 44 + i * 4));
      const base = r + 44 + nPartes * 4;
      const ponto = (i) => [buf.readDoubleLE(base + i * 16), buf.readDoubleLE(base + i * 16 + 8)];
      const aneis = partes.map((ini, i) =>
        Array.from({ length: (partes[i + 1] ?? nPontos) - ini }, (_, k) => ponto(ini + k)),
      );
      const poligonos = aneis.filter((a) => areaComSinal(a) > 0).map((a) => [a]);
      for (const buraco of aneis.filter((a) => areaComSinal(a) <= 0)) {
        const dono = poligonos.find(([externo]) => dentroDoAnel(buraco[0], externo));
        if (dono) dono.push(buraco);
        else poligonos.push([buraco]); // anel solto com orientação trocada: trata como externo
      }
      geometrias.push(
        poligonos.length === 1
          ? { type: 'Polygon', coordinates: poligonos[0] }
          : { type: 'MultiPolygon', coordinates: poligonos },
      );
    }
    p = r + tam;
  }
  return geometrias;
}
