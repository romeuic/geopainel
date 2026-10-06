// Opção "Total" de cada grupo partido + cargo com mais de uma opção: soma,
// município a município, todas as opções do grupo. Calculada na carga da
// página a partir de votos.json, então vale também para os mapas municipais
// (via `componentes`).

// Base do percentual do total: a das opções, se todas tiverem a mesma; senão
// (N/A mistura brancos e nulos, sobre os votos, com ausentes, sobre o
// eleitorado) o eleitorado, que contém todas.
const baseComum = (opcoes) => (opcoes.every((o) => o.base === opcoes[0].base) ? opcoes[0].base : 'eleitores');

export const idTotal = (partido) => `total-${partido.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

function totalDoGrupo(cargo, partido, opcoes) {
  const base = baseComum(opcoes);
  const municipios = {};
  for (const o of opcoes)
    for (const [codigo, { votos }] of Object.entries(o.municipios)) {
      const m = (municipios[codigo] ??= { votos: 0, pct: 0 });
      m.votos += votos;
    }
  let denominador = 0;
  for (const [codigo, dados] of Object.entries(cargo.municipios)) {
    denominador += dados[base] ?? 0;
    const m = municipios[codigo];
    if (m) m.pct = dados[base] ? (m.votos / dados[base]) * 100 : 0;
  }
  const votos = opcoes.reduce((s, o) => s + o.votos, 0);
  return {
    numero: idTotal(partido),
    tipo: 'total',
    nome: 'Total',
    nomeUrna: 'Total',
    partido,
    cargo: cargo.nome,
    situacao: `Soma de ${opcoes.length} opções`,
    base,
    votos,
    pct: denominador ? (votos / denominador) * 100 : 0,
    municipios,
    componentes: opcoes.map((o) => o.numero),
  };
}

/** Devolve os cargos com um "Total" no fim de cada grupo partido + cargo com 2+ opções. */
export function comTotais(cargos) {
  return cargos.map((cargo) => {
    const grupos = new Map();
    for (const c of cargo.candidatos) grupos.set(c.partido, [...(grupos.get(c.partido) ?? []), c]);
    const candidatos = [];
    for (const [partido, opcoes] of grupos) {
      candidatos.push(...opcoes);
      if (opcoes.length > 1) candidatos.push(totalDoGrupo(cargo, partido, opcoes));
    }
    return { ...cargo, candidatos };
  });
}

/** Votos por área de uma opção num mapa municipal; o total soma os componentes. */
export function votosNaCidade(opcao, votosDoCargo) {
  if (!opcao.componentes) return votosDoCargo[opcao.numero] ?? {};
  const soma = {};
  for (const n of opcao.componentes)
    for (const [area, v] of Object.entries(votosDoCargo[n] ?? {})) soma[area] = (soma[area] ?? 0) + v;
  return soma;
}
