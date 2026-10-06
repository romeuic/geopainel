// Gera src/dados/municipios/<código IBGE>.json: o mapa de uma cidade dividido em
// bairros, com os votos de cada bairro somados urna a urna.
//
//   - TSE, votação por seção (votacao_secao_2026_RS): votos de cada urna;
//   - TSE, detalhe da votação por seção (detalhe_votacao_secao_2026): aptos,
//     comparecimento, abstenções, brancos e nulos de cada urna;
//   - TSE, eleitorado por local de votação (eleitorado_local_votacao_2026):
//     seção → local de votação, com coordenadas e bairro cadastrado;
//   - OpenStreetMap: contornos dos bairros e distritos (a malha de bairros do
//     IBGE não delimita bairros em cidades como Passo Fundo).
//
// Cada local de votação cai no bairro que contém suas coordenadas; sem
// coordenadas, vale o nome de bairro cadastrado no TSE (ver `apelidos`).
// Os candidatos são os de src/dados/votos.json: rode `npm run dados` antes.
//
// Uso: node scripts/municipio.mjs [código IBGE…]   (padrão: todas as CIDADES)
// Os arquivos do TSE (~640 MB) ficam em .cache/ e só são baixados uma vez.
// Requer o comando `unzip` (macOS e Linux já trazem).

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dentro, geometriaDaRelacao } from './geo.mjs';

const CIDADES = {
  4314100: {
    nome: 'Passo Fundo',
    tse: '87858',
    // Setores 01–22 da Lei Municipal Complementar 143/2005 (admin_level 10).
    bairros: Array.from({ length: 22 }, (_, i) => 7963047 + i),
    // Distritos do interior (admin_level 9) e o distrito-sede, cujo restante
    // fora dos setores urbanos vira "Interior do distrito-sede".
    distritos: [7337861, 7337857, 7337856, 7337858, 7337859, 20737431],
    sede: 7337860,
    // Bairro cadastrado no TSE → unidade, usado só para locais sem coordenadas.
    apelidos: { INTERIOR: 'interior', 'PRIMEIRO DISTRITO': 'interior' },
  },
};

const UF = 'RS';
const CARGOS = { 7: 'estadual', 6: 'federal', 1: 'presidente' };
const NAO_VALIDOS = new Set(['95', '96', '97']); // branco, nulo, anulado
const CACHE = new URL('../.cache/', import.meta.url);
const SAIDA = new URL('../src/dados/municipios/', import.meta.url);
const CDN = 'https://cdn.tse.jus.br/estatistica/sead/odsele';
// A eleição estadual (deputados) sai por UF; a federal (presidente), num
// arquivo nacional "BR". Os códigos de município do TSE são únicos no país.
const ARQ_SECOES = [
  { url: `${CDN}/votacao_secao/votacao_secao_2026_${UF}.zip`, csv: `votacao_secao_2026_${UF}.csv` },
  { url: `${CDN}/votacao_secao/votacao_secao_2026_BR.zip`, csv: 'votacao_secao_2026_BR.csv' },
];
const ARQ_DETALHE = {
  url: `${CDN}/detalhe_votacao_secao/detalhe_votacao_secao_2026.zip`,
  csvs: [`detalhe_votacao_secao_2026_${UF}.csv`, 'detalhe_votacao_secao_2026_BR.csv'],
};
const ARQ_LOCAIS = {
  url: `${CDN}/eleitorado_locais_votacao/eleitorado_local_votacao_2026.zip`,
  csv: `eleitorado_local_votacao_2026_${UF}.csv`,
};
const OSM = 'https://api.openstreetmap.org/api/0.6/relation';
const AGENTE = 'geopainel/0.1 (mapa eleitoral; dados abertos)';

const normalizar = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/^(VILA|VL\.?|BAIRRO|LOT\.?|LOTEAMENTO)\s+/, '')
    .trim();
const slug = (s) =>
  normalizar(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
const arredondar = (coords) =>
  typeof coords[0] === 'number' ? coords.map((c) => Math.round(c * 1e4) / 1e4) : coords.map(arredondar);

async function baixar(url, nome) {
  const destino = new URL(nome, CACHE);
  if (existsSync(destino)) return destino;
  console.log(`Baixando ${url}…`);
  const r = await fetch(url, { headers: { 'User-Agent': AGENTE } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const parcial = new URL(`${nome}.parcial`, CACHE);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(parcial));
  await rename(parcial, destino);
  return destino;
}

// Linha de CSV do TSE: separador ";", campos entre aspas (sem ";" dentro).
const campos = (linha) => linha.split(';').map((c) => (c.startsWith('"') ? c.slice(1, -1) : c));

// Percorre as linhas de um CSV dentro de um zip, em latin1, chamando fn(registro)
// só para as linhas em que `filtro(linhaCrua)` é verdadeiro.
async function lerCsvDoZip(zip, entrada, filtro, fn) {
  const unzip = spawn('unzip', ['-p', zip.pathname, entrada]);
  unzip.stdout.setEncoding('latin1');
  let cabecalho;
  for await (const linha of createInterface({ input: unzip.stdout, crlfDelay: Infinity })) {
    if (!cabecalho) {
      cabecalho = campos(linha);
      continue;
    }
    if (!filtro(linha)) continue;
    const valores = campos(linha);
    fn(Object.fromEntries(cabecalho.map((c, i) => [c, valores[i]])));
  }
  const codigo = await new Promise((ok) => unzip.on('close', ok));
  if (codigo !== 0) throw new Error(`unzip saiu com código ${codigo} em ${entrada}`);
}

async function relacaoOsm(id) {
  const arquivo = await baixar(`${OSM}/${id}/full.json`, `osm-${id}.json`);
  const { elements } = JSON.parse(await readFile(arquivo, 'utf8'));
  const r = geometriaDaRelacao(elements);
  if (r.soltos) console.warn(`Aviso: relação ${id} (${r.tags.name}) tem ${r.soltos} trecho(s) que não fecham.`);
  return r;
}

async function gerarCidade(codigo, cidade, votosEstado, zips) {
  console.log(`${cidade.nome}: contornos do OpenStreetMap…`);
  const unidades = [];
  const sede = await relacaoOsm(cidade.sede);
  unidades.push({ id: 'interior', nome: 'Interior do distrito-sede', tipo: 'interior', geometria: sede.geometria });
  for (const id of cidade.distritos) {
    const { tags, geometria } = await relacaoOsm(id);
    unidades.push({ id: slug(tags.name), nome: tags.name, tipo: 'distrito', geometria });
  }
  for (const id of cidade.bairros) {
    const { tags, geometria } = await relacaoOsm(id);
    const nomes = [tags.name, tags.old_name, tags.official_name].filter(Boolean);
    unidades.push({
      id: slug(tags.name),
      nome: tags.name,
      tipo: 'bairro',
      setor: tags.official_name,
      geometria,
      nomes,
    });
  }
  // Ordem de busca: bairro, distrito, e por fim o resto do distrito-sede.
  const ordemBusca = [...unidades.filter((u) => u.tipo === 'bairro'), ...unidades.filter((u) => u.tipo !== 'bairro')];
  const porNome = new Map();
  for (const u of unidades) for (const n of [u.nome, ...(u.nomes ?? [])]) porNome.set(normalizar(n), u.id);
  for (const [apelido, id] of Object.entries(cidade.apelidos)) porNome.set(normalizar(apelido), id);

  console.log(`${cidade.nome}: locais de votação…`);
  // Um prédio pode atender as duas zonas com números de local diferentes: a
  // chave é nome + endereço, para cada prédio contar uma vez só.
  const locais = new Map(); // "nome|endereço" → local
  const secoes = new Map(); // "zona-seção" → local
  await lerCsvDoZip(
    zips.locais,
    ARQ_LOCAIS.csv,
    (l) => l.includes(`"${cidade.tse}"`),
    (r) => {
      if (r.CD_MUNICIPIO !== cidade.tse || r.NR_TURNO !== '1') return;
      const chave = `${normalizar(r.NM_LOCAL_VOTACAO)}|${normalizar(r.DS_ENDERECO)}`;
      let local = locais.get(chave);
      if (!local) {
        const lat = Number(r.NR_LATITUDE.replace(',', '.'));
        const lon = Number(r.NR_LONGITUDE.replace(',', '.'));
        const temCoord = lat && lon && lat !== -1 && lon !== -1;
        local = {
          nome: r.NM_LOCAL_VOTACAO,
          bairroTse: r.NM_BAIRRO,
          ponto: temCoord ? [lon, lat] : null,
          urnas: 0,
        };
        locais.set(chave, local);
      }
      if (r.DS_TIPO_SECAO_AGREGADA !== 'Agregada') local.urnas += 1;
      secoes.set(`${r.NR_ZONA}-${r.NR_SECAO}`, local);
    },
  );

  const semUnidade = [];
  for (const local of locais.values()) {
    local.unidade = local.ponto
      ? ordemBusca.find((u) => dentro(local.ponto, u.geometria))?.id
      : porNome.get(normalizar(local.bairroTse));
    if (!local.unidade) semUnidade.push(`${local.nome} (${local.bairroTse})`);
  }
  if (semUnidade.length) throw new Error(`Locais sem bairro: ${semUnidade.join('; ')}. Ajuste os apelidos.`);
  const semCoord = [...locais.values()].filter((l) => !l.ponto);
  if (semCoord.length)
    console.log(
      `  ${semCoord.length} local(is) sem coordenadas, pelo nome: ${semCoord.map((l) => `${l.nome} → ${l.unidade}`).join('; ')}`,
    );

  console.log(`${cidade.nome}: votos por seção…`);
  const pedidos = Object.fromEntries(
    votosEstado.cargos.map((c) => [c.codigo, new Set(c.candidatos.map((x) => x.numero))]),
  );
  const cargos = Object.fromEntries(
    Object.values(CARGOS).map((c) => [c, { eleitores: {}, validos: {}, comparecimento: {}, votos: {} }]),
  );
  const somar = (obj, id, n) => (obj[id] = (obj[id] ?? 0) + n);
  for (const [i, arq] of ARQ_SECOES.entries())
    await lerCsvDoZip(
      zips.secoes[i],
      arq.csv,
      (l) => l.includes(`;${cidade.tse};`),
      (r) => {
        const cargo = CARGOS[r.CD_CARGO];
        if (r.CD_MUNICIPIO !== cidade.tse || r.NR_TURNO !== '1' || !cargo) return;
        const local = secoes.get(`${r.NR_ZONA}-${r.NR_SECAO}`);
        if (!local) throw new Error(`Seção ${r.NR_ZONA}/${r.NR_SECAO} sem local de votação.`);
        const n = Number(r.QT_VOTOS);
        if (!NAO_VALIDOS.has(r.NR_VOTAVEL)) somar(cargos[cargo].validos, local.unidade, n);
        if (pedidos[cargo]?.has(r.NR_VOTAVEL)) somar((cargos[cargo].votos[r.NR_VOTAVEL] ??= {}), local.unidade, n);
      },
    );

  // Brancos, nulos e ausentes (opções "N/A") e eleitores aptos vêm do detalhe
  // por seção, que traz as abstenções. Aptos são por cargo: na eleição federal
  // entram também eleitores em trânsito.
  console.log(`${cidade.nome}: detalhe por seção (aptos, abstenções, brancos, nulos)…`);
  for (const csv of ARQ_DETALHE.csvs)
    await lerCsvDoZip(
      zips.detalhe,
      csv,
      (l) => l.includes(`;${cidade.tse};`),
      (r) => {
        const cargo = CARGOS[r.CD_CARGO];
        if (r.CD_MUNICIPIO !== cidade.tse || r.NR_TURNO !== '1' || !cargo) return;
        const local = secoes.get(`${r.NR_ZONA}-${r.NR_SECAO}`);
        if (!local) throw new Error(`Seção ${r.NR_ZONA}/${r.NR_SECAO} sem local de votação.`);
        const c = cargos[cargo];
        somar(c.eleitores, local.unidade, Number(r.QT_APTOS));
        somar(c.comparecimento, local.unidade, Number(r.QT_COMPARECIMENTO));
        somar((c.votos.brancos ??= {}), local.unidade, Number(r.QT_VOTOS_BRANCOS));
        somar((c.votos.nulos ??= {}), local.unidade, Number(r.QT_VOTOS_NULOS));
        somar((c.votos.ausentes ??= {}), local.unidade, Number(r.QT_ABSTENCOES));
      },
    );

  // Conferência com o resultado por município de votos.json. Os nulos oficiais
  // incluem os "nulos técnicos", que o detalhe por seção não traz.

  for (const c of votosEstado.cargos) {
    const eleitores = Object.values(cargos[c.codigo].eleitores).reduce((s, n) => s + n, 0);
    if (eleitores !== c.municipios[codigo]?.eleitores)
      console.warn(
        `Aviso: ${c.codigo} — aptos nas seções (${eleitores}) ≠ resultado (${c.municipios[codigo]?.eleitores}).`,
      );
    for (const cand of c.candidatos) {
      const soma = Object.values(cargos[c.codigo].votos[cand.numero] ?? {}).reduce((s, n) => s + n, 0);
      const esperado = cand.municipios[codigo]?.votos ?? 0;
      if (soma === esperado) continue;
      if (cand.numero === 'nulos')
        console.log(`  ${c.codigo} nulos: ${soma} nas seções, ${esperado} oficiais (diferença = nulos técnicos).`);
      else
        console.warn(
          `Aviso: ${c.codigo} ${cand.numero} — soma das seções (${soma}) ≠ resultado da cidade (${esperado}).`,
        );
    }
  }

  const resumo = new Map(unidades.map((u) => [u.id, { urnas: 0, locais: 0 }]));
  for (const l of locais.values()) {
    const s = resumo.get(l.unidade);
    s.urnas += l.urnas;
    s.locais += 1;
  }

  return {
    codigo,
    nome: cidade.nome,
    fonte: {
      tse: [...ARQ_SECOES.map((a) => a.url), ARQ_DETALHE.url, ARQ_LOCAIS.url].join('; '),
      osm: 'Contornos © colaboradores do OpenStreetMap (ODbL); setores da LMC 143/2005',
    },
    unidades: unidades.map((u) => ({
      id: u.id,
      nome: u.nome,
      tipo: u.tipo,
      ...(u.setor ? { setor: u.setor } : {}),
      ...resumo.get(u.id),
    })),
    // Na ordem de desenho: interior, distritos, bairros por cima.
    areas: {
      type: 'FeatureCollection',
      features: unidades.map((u) => ({
        type: 'Feature',
        properties: { id: u.id },
        geometry: { type: u.geometria.type, coordinates: arredondar(u.geometria.coordinates) },
      })),
    },
    locais: [...locais.values()]
      .filter((l) => l.ponto)
      .map((l) => ({ nome: l.nome, unidade: l.unidade, urnas: l.urnas, ponto: arredondar(l.ponto) })),
    cargos,
  };
}

async function main() {
  const codigos = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(CIDADES);
  for (const c of codigos) if (!CIDADES[c]) throw new Error(`Cidade ${c} não configurada em CIDADES.`);
  const votosEstado = JSON.parse(await readFile(new URL('../src/dados/votos.json', import.meta.url), 'utf8'));
  await mkdir(CACHE, { recursive: true });
  await mkdir(SAIDA, { recursive: true });
  const zips = {
    secoes: await Promise.all(ARQ_SECOES.map((a) => baixar(a.url, a.url.split('/').at(-1)))),
    detalhe: await baixar(ARQ_DETALHE.url, ARQ_DETALHE.url.split('/').at(-1)),
    locais: await baixar(ARQ_LOCAIS.url, ARQ_LOCAIS.url.split('/').at(-1)),
  };
  for (const codigo of codigos) {
    const dados = await gerarCidade(codigo, CIDADES[codigo], votosEstado, zips);
    await writeFile(new URL(`${codigo}.json`, SAIDA), JSON.stringify(dados) + '\n');
    const total = dados.unidades.reduce((s, u) => s + u.urnas, 0);
    console.log(
      `Pronto: ${dados.nome} — ${dados.unidades.length} áreas, ${dados.locais.length} locais, ${total} urnas.`,
    );
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
