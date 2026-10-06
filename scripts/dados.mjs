// Gera os JSONs de src/dados/ a partir das fontes oficiais:
//   - TSE: resultado da eleição estadual de 2026 (1º turno), um arquivo por município;
//   - IBGE: malha municipal do RS e nomes dos municípios.
// Uso: node scripts/dados.mjs [numero-do-candidato]   (padrão: 65065)

import { writeFile } from 'node:fs/promises';

const NUMERO = process.argv[2] ?? '65065';
const UF = 'rs';
const COD_UF_IBGE = 43;
const ELEICAO = '6259'; // Eleição Ordinária Estadual - 2026 1º Turno
const CARGO = '0007'; // Deputado Estadual
const TSE = `https://resultados.tse.jus.br/oficial/ele2026/${ELEICAO}`;
const IBGE = 'https://servicodados.ibge.gov.br/api';
const SAIDA = new URL('../src/dados/', import.meta.url);

const num = (s) => Number(String(s).replace(',', '.'));

async function json(url, tentativas = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (erro) {
      if (i >= tentativas) throw erro;
      await new Promise((ok) => setTimeout(ok, 1000 * i));
    }
  }
}

// Executa fn sobre os itens com no máximo `limite` requisições simultâneas.
async function emLotes(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await fn(itens[i], i);
    }
  };
  await Promise.all(Array.from({ length: limite }, trabalhador));
  return resultados;
}

function acharCandidato(arquivo) {
  const cargo = arquivo.carg.find((c) => c.cd === String(Number(CARGO)));
  for (const agr of cargo.agr)
    for (const par of agr.par) for (const cand of par.cand ?? []) if (cand.n === NUMERO) return { cand, par };
  return null;
}

// Arredonda coordenadas a 3 casas (~100 m): municípios vizinhos compartilham
// vértices idênticos, então o arredondamento não abre frestas entre eles.
const arredondar = (coords) =>
  typeof coords[0] === 'number' ? coords.map((c) => Math.round(c * 1000) / 1000) : coords.map(arredondar);

async function main() {
  console.log('IBGE: nomes e malha municipal…');
  const [localidades, malha] = await Promise.all([
    json(`${IBGE}/v1/localidades/estados/${COD_UF_IBGE}/municipios`),
    json(
      `${IBGE}/v3/malhas/estados/${COD_UF_IBGE}?formato=application/vnd.geo%2Bjson&intrarregiao=municipio&qualidade=intermediaria`,
    ),
  ]);
  const nomes = new Map(localidades.map((m) => [String(m.id), m.nome]));

  console.log('TSE: tabela de municípios e resultado estadual…');
  const tabela = await json(`${TSE}/config/mun-e00${ELEICAO}-cm.json`);
  const municipiosTse = tabela.abr.find((a) => a.cd.toLowerCase() === UF).mu;
  const estadual = await json(`${TSE}/dados/${UF}/${UF}-c${CARGO}-e00${ELEICAO}-u.json`);
  const achado = acharCandidato(estadual);
  if (!achado) throw new Error(`Candidato ${NUMERO} não encontrado no resultado de ${UF.toUpperCase()}.`);
  const { cand, par } = achado;

  console.log(`TSE: ${municipiosTse.length} municípios…`);
  const linhas = await emLotes(municipiosTse, 6, async (m, i) => {
    const arq = await json(`${TSE}/dados/${UF}/${UF}${m.cd}-c${CARGO}-e00${ELEICAO}-u.json`);
    const c = acharCandidato(arq)?.cand;
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${municipiosTse.length}`);
    return {
      ibge: m.cdi,
      votos: c ? num(c.vap) : 0,
      pct: c ? num(c.pvapn) : 0,
      validos: num(arq.v.vv),
      secoes: num(arq.s.pstn),
    };
  });

  const porMunicipio = {};
  for (const { ibge, ...resto } of linhas) porMunicipio[ibge] = resto;
  const soma = linhas.reduce((s, l) => s + l.votos, 0);
  if (soma !== num(cand.vap)) console.warn(`Aviso: soma municipal (${soma}) difere do total estadual (${cand.vap}).`);

  const votos = {
    candidato: {
      numero: cand.n,
      nome: cand.nm,
      nomeUrna: cand.nmu,
      partido: par.sg,
      cargo: 'Deputado Estadual',
      situacao: cand.st,
      votos: num(cand.vap),
      pct: num(cand.pvapn),
    },
    fonte: {
      eleicao: 'Eleições 2026 — 1º turno (04/10/2026)',
      tse: `${TSE}/dados/${UF}/`,
      geradoEm: `${estadual.dg} ${estadual.hg}`,
      totalizacao: estadual.tf === 's' ? 'final' : 'parcial',
    },
    municipios: porMunicipio,
  };

  const features = malha.features.map((f) => {
    const codigo = String(f.properties.codarea);
    return {
      type: 'Feature',
      properties: { codigo, nome: nomes.get(codigo) ?? codigo },
      geometry: { type: f.geometry.type, coordinates: arredondar(f.geometry.coordinates) },
    };
  });

  const semVoto = features.filter((f) => !porMunicipio[f.properties.codigo]).map((f) => f.properties.nome);
  if (semVoto.length) console.warn(`Aviso: municípios da malha sem resultado do TSE: ${semVoto.join(', ')}`);

  await writeFile(new URL(`votos-${NUMERO}.json`, SAIDA), JSON.stringify(votos, null, 1) + '\n');
  await writeFile(
    new URL('municipios-rs.geo.json', SAIDA),
    JSON.stringify({ type: 'FeatureCollection', features }) + '\n',
  );
  console.log(`Pronto: ${cand.nmu} (${cand.n}) — ${soma} votos em ${linhas.filter((l) => l.votos).length} municípios.`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
