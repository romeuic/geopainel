// Gera os JSONs de src/dados/ a partir das fontes oficiais:
//   - TSE: resultado da eleição estadual de 2026 (1º turno), um arquivo por município e cargo;
//   - IBGE: malha municipal do RS e nomes dos municípios.
//
// Uso: node scripts/dados.mjs [estadual|federal números…]…   (padrão: PADRAO abaixo)
//   ex.: node scripts/dados.mjs estadual 65065 65 federal 6565:f
// A palavra do cargo vale para os números que a seguem.
// Número de 2 dígitos (ex.: 65) = votos na legenda do partido, sem candidato.
// Sufixo ":f" marca candidata (ex.: 65123:f) para o cargo sair no feminino; o
// resultado do TSE não informa gênero e a API de candidaturas bloqueia scripts.
//
// Tudo vai para um único src/dados/votos.json, com um bloco por cargo; cada
// arquivo municipal do TSE é baixado uma vez só por cargo.

import { writeFile } from 'node:fs/promises';

const CARGOS = {
  estadual: { cd: '0007', rotulo: 'Dep. Estadual' },
  federal: { cd: '0006', rotulo: 'Dep. Federal' },
};
const PADRAO = {
  estadual: ['65065', '65656', '65444', '65653', '65123:f', '65651:f', '65'],
  federal: ['6565:f', '6500', '65', '1330', '1307'],
};
const UF = 'rs';
const COD_UF_IBGE = 43;
const ELEICAO = '6259'; // Eleição Ordinária Estadual - 2026 1º Turno
const TSE = `https://resultados.tse.jus.br/oficial/ele2026/${ELEICAO}`;
const IBGE = 'https://servicodados.ibge.gov.br/api';
const SAIDA = new URL('../src/dados/', import.meta.url);

const num = (s) => Number(String(s).replace(',', '.'));
const ehLegenda = (numero) => numero.length === 2;

// argv → { estadual: [{ numero, feminino }], federal: […] }, na ordem pedida.
function lerPedidos(args) {
  const listas = args.length ? {} : PADRAO;
  let cargo = 'estadual';
  for (const a of args) {
    if (CARGOS[a]) cargo = a;
    else (listas[cargo] ??= []).push(a);
  }
  return Object.fromEntries(
    Object.entries(listas).map(([cargo, lista]) => [
      cargo,
      lista.map((a) => {
        const [numero, genero] = a.split(':');
        return { numero, feminino: genero === 'f' };
      }),
    ]),
  );
}

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

// Mapa número → { votos, pct, cand, par } do que foi pedido e está no arquivo.
// Candidato: votos nominais. Legenda (2 dígitos): votos só no partido, com o
// percentual calculado sobre os válidos, como o TSE faz para os nominais.
function acharCandidatos(arquivo, numeros) {
  const cargo = arquivo.carg[0];
  const validos = num(arquivo.v.vv);
  const achados = new Map();
  for (const agr of cargo.agr)
    for (const par of agr.par) {
      if (numeros.includes(par.n)) {
        const votos = num(par.tvtl);
        achados.set(par.n, { votos, pct: validos ? (votos / validos) * 100 : 0, par });
      }
      for (const cand of par.cand ?? [])
        if (numeros.includes(cand.n)) achados.set(cand.n, { votos: num(cand.vap), pct: num(cand.pvapn), cand, par });
    }
  return achados;
}

// Arredonda coordenadas a 3 casas (~100 m): municípios vizinhos compartilham
// vértices idênticos, então o arredondamento não abre frestas entre eles.
const arredondar = (coords) =>
  typeof coords[0] === 'number' ? coords.map((c) => Math.round(c * 1000) / 1000) : coords.map(arredondar);

async function gerarCargo(codigo, pedidos, municipiosTse) {
  const { cd, rotulo } = CARGOS[codigo];
  const numeros = pedidos.map((p) => p.numero);
  const estadual = await json(`${TSE}/dados/${UF}/${UF}-c${cd}-e00${ELEICAO}-u.json`);
  const cargoTse = estadual.carg[0];
  const noEstado = acharCandidatos(estadual, numeros);
  const faltando = numeros.filter((n) => !noEstado.has(n));
  if (faltando.length)
    throw new Error(`${cargoTse.nmn}: ${faltando.join(', ')} não encontrado(s) no resultado de ${UF.toUpperCase()}.`);

  console.log(`TSE ${cargoTse.nmn}: ${municipiosTse.length} municípios…`);
  const linhas = await emLotes(municipiosTse, 6, async (m, i) => {
    const arq = await json(`${TSE}/dados/${UF}/${UF}${m.cd}-c${cd}-e00${ELEICAO}-u.json`);
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${municipiosTse.length}`);
    return {
      ibge: m.cdi,
      eleitores: num(arq.e.te),
      validos: num(arq.v.vv),
      secoes: num(arq.s.pstn),
      achados: acharCandidatos(arq, numeros),
    };
  });

  const municipios = {};
  for (const l of linhas) municipios[l.ibge] = { eleitores: l.eleitores, validos: l.validos, secoes: l.secoes };

  // Por candidato, só os municípios com voto; ausente no JSON = 0 votos.
  const candidatos = pedidos.map(({ numero, feminino }) => {
    const total = noEstado.get(numero);
    const { cand, par } = total;
    const legenda = ehLegenda(numero);
    const porMunicipio = {};
    for (const l of linhas) {
      const a = l.achados.get(numero);
      if (a?.votos > 0) porMunicipio[l.ibge] = { votos: a.votos, pct: a.pct };
    }
    const soma = Object.values(porMunicipio).reduce((s, m) => s + m.votos, 0);
    if (soma !== total.votos)
      console.warn(`Aviso: ${numero} — soma municipal (${soma}) difere do total estadual (${total.votos}).`);
    const nomeUrna = legenda ? 'Votos na legenda' : cand.nmu;
    console.log(`  ${nomeUrna} (${numero}): ${soma} votos em ${Object.keys(porMunicipio).length} municípios.`);
    return {
      numero,
      tipo: legenda ? 'legenda' : 'candidatura',
      nome: legenda ? par.nm : cand.nm,
      nomeUrna,
      partido: par.sg,
      cargo: legenda ? cargoTse.nmn : feminino ? cargoTse.nmf : cargoTse.nmm,
      // O TSE grava "Eleito" também para candidatas.
      situacao: legenda ? null : feminino ? cand.st.replace(/^Eleito\b/, 'Eleita') : cand.st,
      votos: total.votos,
      pct: total.pct,
      municipios: porMunicipio,
    };
  });

  return {
    cargo: { codigo, nome: cargoTse.nmn, rotulo, municipios, candidatos },
    fonte: { geradoEm: `${estadual.dg} ${estadual.hg}`, final: estadual.tf === 's' },
  };
}

async function main() {
  const pedidos = lerPedidos(process.argv.slice(2));

  console.log('IBGE: nomes e malha municipal…');
  const [localidades, malha] = await Promise.all([
    json(`${IBGE}/v1/localidades/estados/${COD_UF_IBGE}/municipios`),
    json(
      `${IBGE}/v3/malhas/estados/${COD_UF_IBGE}?formato=application/vnd.geo%2Bjson&intrarregiao=municipio&qualidade=intermediaria`,
    ),
  ]);
  const nomes = new Map(localidades.map((m) => [String(m.id), m.nome]));

  console.log('TSE: tabela de municípios…');
  const tabela = await json(`${TSE}/config/mun-e00${ELEICAO}-cm.json`);
  const municipiosTse = tabela.abr.find((a) => a.cd.toLowerCase() === UF).mu;

  const gerados = [];
  for (const [codigo, lista] of Object.entries(pedidos)) gerados.push(await gerarCargo(codigo, lista, municipiosTse));

  const votos = {
    fonte: {
      eleicao: 'Eleições 2026 — 1º turno (04/10/2026)',
      tse: `${TSE}/dados/${UF}/`,
      geradoEm: gerados
        .map((g) => g.fonte.geradoEm)
        .sort()
        .at(-1),
      totalizacao: gerados.every((g) => g.fonte.final) ? 'final' : 'parcial',
    },
    cargos: gerados.map((g) => g.cargo),
  };

  const features = malha.features.map((f) => {
    const codigo = String(f.properties.codarea);
    return {
      type: 'Feature',
      properties: { codigo, nome: nomes.get(codigo) ?? codigo },
      geometry: { type: f.geometry.type, coordinates: arredondar(f.geometry.coordinates) },
    };
  });

  for (const cargo of votos.cargos) {
    const semVoto = features.filter((f) => !cargo.municipios[f.properties.codigo]).map((f) => f.properties.nome);
    if (semVoto.length) console.warn(`Aviso: ${cargo.nome} — municípios sem resultado do TSE: ${semVoto.join(', ')}`);
  }

  await writeFile(new URL('votos.json', SAIDA), JSON.stringify(votos, null, 1) + '\n');
  await writeFile(
    new URL('municipios-rs.geo.json', SAIDA),
    JSON.stringify({ type: 'FeatureCollection', features }) + '\n',
  );
  const n = votos.cargos.reduce((s, c) => s + c.candidatos.length, 0);
  console.log(`Pronto: ${n} opção(ões) em ${votos.cargos.length} cargo(s) em src/dados/votos.json.`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
