import { criarProjecao } from './projecao.js';

// Cidades com mapa por bairro (gerados por scripts/municipio.mjs). Cada JSON
// vira um pedaço separado do bundle e só é baixado quando o mapa é aberto.
const carregadores = import.meta.glob('./dados/municipios/*.json', { import: 'default' });

export const CIDADES_DETALHADAS = new Map(
  Object.entries(carregadores).map(([caminho, carregar]) => [caminho.match(/(\d+)\.json$/)[1], carregar]),
);

export const RECORTES = { urbano: 'Zona urbana', municipio: 'Município inteiro' };

// Projeta todas as áreas e locais, enquadrando só `ajuste`: no recorte urbano o
// que fica fora dos bairros é cortado pela borda do SVG.
function projetar(dados, ajuste, porId) {
  const projecao = criarProjecao(ajuste, 1000);
  return {
    largura: projecao.largura,
    altura: projecao.altura,
    formas: dados.areas.features.map((f) => ({
      ...porId.get(f.properties.id),
      codigo: f.properties.id,
      d: projecao.caminho(f),
    })),
    pontos: dados.locais.map((l) => {
      const [x, y] = projecao.ponto(l.ponto);
      return { x, y, r: 2 + Math.sqrt(l.urnas) * 0.9, nome: l.nome, urnas: l.urnas };
    }),
  };
}

/**
 * Baixa a cidade e projeta seus dois recortes. As formas ficam na ordem de
 * desenho do arquivo: interior, distritos e, por cima, os bairros.
 */
export async function carregarCidade(codigo) {
  const dados = await CIDADES_DETALHADAS.get(codigo)();
  const porId = new Map(dados.unidades.map((u) => [u.id, u]));
  const bairros = dados.areas.features.filter((f) => porId.get(f.properties.id).tipo === 'bairro');
  return {
    ...dados,
    // Só cidades com distritos/interior além dos bairros têm o que recortar.
    temInterior: bairros.length < dados.areas.features.length,
    recortes: {
      urbano: projetar(dados, { features: bairros }, porId),
      municipio: projetar(dados, dados.areas, porId),
    },
  };
}
