import { batch, createMemo, createSignal, For, onMount, Show } from 'solid-js';
import malha from './dados/municipios-rs.geo.json';
import resultado from './dados/votos.json';
import Mapa from './Mapa.jsx';
import Legenda from './Legenda.jsx';
import { cor, posicao } from './escala.js';
import { criarProjecao } from './projecao.js';
import * as fmt from './formato.js';
import { CIDADES_DETALHADAS, RECORTES, carregarCidade } from './cidades.js';
import { comTotais, votosNaCidade } from './totais.js';

// Cada grupo partido + cargo com 2+ opções ganha um "Total" (src/totais.js).
const cargos = comTotais(resultado.cargos);
const { fonte } = resultado;
const projecao = criarProjecao(malha, 1000);

// Formas do estado, que não mudam com cargo nem candidato.
const formas = malha.features
  .map((f) => ({ codigo: f.properties.codigo, nome: f.properties.nome, d: projecao.caminho(f) }))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

const SEM_VOTO = { votos: 0, pct: 0 };
const OPCOES_CARGO = Object.fromEntries(cargos.map((c) => [c.codigo, c.rotulo]));

// Partidos na ordem em que aparecem nos dados; sigla do TSE → nome de exibição.
// "N/A" (brancos, nulos, ausentes) fica sempre por último.
const PARTIDOS = [...new Set(cargos.flatMap((c) => c.candidatos.map((x) => x.partido)))].sort(
  (a, b) => (a === 'N/A') - (b === 'N/A'),
);
const OPCOES_PARTIDO = Object.fromEntries(PARTIDOS.map((p) => [p, fmt.partido(p)]));

const doPartido = (cargo, partido) => cargo.candidatos.filter((c) => c.partido === partido);
// O cargo preferido, se tiver opção do partido; senão o primeiro que tenha.
const cargoComPartido = (partido, preferido) =>
  preferido && doPartido(preferido, partido).length ? preferido : cargos.find((c) => doPartido(c, partido).length);

// O que abre quem entra no site sem nada na URL.
const INICIO = { cargo: 'presidente', candidato: 'brancos' };

// Seleção inicial vem de ?partido=…&cargo=…&candidato=…, para o link ser
// compartilhável; sem nenhum dos três, vale INICIO. O número manda: partido e
// cargo são os dele; sem cargo na URL, vale o primeiro cargo onde o número
// existe (a legenda "65" existe nos dois).
function selecaoDaUrl() {
  const busca = new URLSearchParams(location.search);
  const vazia = !['partido', 'cargo', 'candidato'].some((k) => busca.has(k));
  const numero = vazia ? INICIO.candidato : busca.get('candidato');
  const temNumero = (c) => c.candidatos.some((x) => x.numero === numero);
  const doCargo = cargos.find((c) => c.codigo === (vazia ? INICIO.cargo : busca.get('cargo')));
  const achado = doCargo && temNumero(doCargo) ? doCargo : cargos.find(temNumero);
  if (achado) {
    const partido = achado.candidatos.find((x) => x.numero === numero).partido;
    return { partido, cargo: achado.codigo, numero };
  }
  const partido = PARTIDOS.includes(busca.get('partido')) ? busca.get('partido') : PARTIDOS[0];
  const cargo = cargoComPartido(partido, doCargo);
  return { partido, cargo: cargo.codigo, numero: doPartido(cargo, partido)[0].numero };
}

const MEDIDAS = {
  // rotulo: o botão; nome: o mesmo, dentro de frases ("Maiores por …").
  votos: { rotulo: 'Votos', nome: 'votos', titulo: (_, escopo) => `Votos por ${escopo}`, formatar: fmt.votos },
  pct: {
    rotulo: '% dos válidos',
    nome: '% dos válidos',
    titulo: (cargo) => `Percentual dos votos válidos para ${cargo.nome.toLowerCase()}`,
    formatar: fmt.pct,
  },
  prop: {
    rotulo: 'A cada 100',
    nome: 'eleitores a cada 100',
    titulo: (_, escopo) => `Eleitores que votaram nesta opção, a cada 100, por ${escopo} (de 0 a 100)`,
    formatar: fmt.proporcao,
  },
};
// Base do percentual de cada opção (campo `base` em votos.json): candidaturas
// e legenda sobre os válidos; brancos e nulos sobre o total de votos;
// ausentes sobre o eleitorado apto — as mesmas bases do TSE.
const BASES = {
  validos: {
    rotulo: '% dos válidos',
    titulo: (cargo) => `Percentual dos votos válidos para ${cargo.nome.toLowerCase()}`,
    curto: 'Dos válidos',
    dica: 'dos válidos',
  },
  votos: {
    rotulo: '% dos votos',
    titulo: (cargo) => `Percentual do total de votos para ${cargo.nome.toLowerCase()}`,
    curto: 'Dos votos',
    dica: 'dos votos',
  },
  eleitores: {
    rotulo: '% do eleitorado',
    titulo: () => 'Percentual do eleitorado apto',
    curto: 'Do eleitorado',
    dica: 'do eleitorado',
  },
};
const ESCALAS = { log: 'Logarítmica', linear: 'Linear' };
// "no município", "no bairro"… para os rótulos do painel.
const ONDE = { municipio: 'no município', bairro: 'no bairro', distrito: 'no distrito', interior: 'na área' };
const NO_RANKING = 15;

function Alternador(props) {
  return (
    <div class="alternador" role="radiogroup" aria-label={props.rotulo}>
      <span class="rotulo">{props.rotulo}</span>
      <For each={Object.entries(props.opcoes)}>
        {([valor, texto]) => (
          <button
            type="button"
            role="radio"
            aria-checked={props.valor === valor}
            disabled={props.desabilitadas?.has(valor)}
            title={props.desabilitadas?.has(valor) ? props.motivo : undefined}
            onClick={() => props.onEscolher(valor)}
          >
            {texto}
          </button>
        )}
      </For>
    </div>
  );
}

export default function App() {
  const inicial = selecaoDaUrl();
  const [partido, setPartido] = createSignal(inicial.partido);
  const [codigoCargo, setCodigoCargo] = createSignal(inicial.cargo);
  const [numero, setNumero] = createSignal(inicial.numero);
  const [medida, setMedida] = createSignal('votos');
  const [escala, setEscala] = createSignal('log');
  const [foco, setFoco] = createSignal(null);
  const [fixado, setFixado] = createSignal(null);
  const [busca, setBusca] = createSignal('');
  // Cidade aberta no mapa municipal (dados já projetados) ou null para o estado.
  const [cidade, setCidade] = createSignal(null);
  const [carregando, setCarregando] = createSignal(null);
  const [recorte, setRecorte] = createSignal('municipio');
  const vistaCidade = () => cidade()?.recortes[recorte()];

  const cargo = createMemo(() => cargos.find((c) => c.codigo === codigoCargo()));
  const opcoes = createMemo(() => doPartido(cargo(), partido()));
  const candidato = createMemo(() => opcoes().find((c) => c.numero === numero()));
  const base = () => BASES[candidato().base];
  // A medida "%" troca de rótulo conforme a base da opção escolhida.
  const med = (k) =>
    k === 'pct' ? { ...MEDIDAS.pct, rotulo: base().rotulo, nome: base().rotulo, titulo: base().titulo } : MEDIDAS[k];
  const cargosSemPartido = createMemo(
    () => new Set(cargos.filter((c) => !doPartido(c, partido()).length).map((c) => c.codigo)),
  );
  // Uma linha por área da vista atual: municípios do estado ou bairros da cidade.
  const municipios = createMemo(() => {
    const c = cidade();
    if (c) {
      const dadosCargo = c.cargos[codigoCargo()];
      const votos = votosNaCidade(candidato(), dadosCargo.votos);
      return vistaCidade().formas.map((f) => {
        const n = votos[f.codigo] ?? 0;
        const validos = dadosCargo.validos[f.codigo] ?? 0;
        // Aptos variam por cargo (na eleição federal entram eleitores em trânsito).
        const eleitores = dadosCargo.eleitores[f.codigo] ?? 0;
        const prop = eleitores ? (n / eleitores) * 100 : 0;
        const base = { validos, votos: dadosCargo.comparecimento[f.codigo] ?? 0, eleitores }[candidato().base];
        return { ...f, eleitores, validos, votos: n, pct: base ? (n / base) * 100 : 0, prop };
      });
    }
    const votos = candidato().municipios;
    const base = cargo().municipios;
    return formas.map((f) => {
      const { eleitores = 0, validos = 0 } = base[f.codigo] ?? {};
      const v = votos[f.codigo] ?? SEM_VOTO;
      return { ...f, tipo: 'municipio', eleitores, validos, ...v, prop: eleitores ? (v.votos / eleitores) * 100 : 0 };
    });
  });
  const porCodigo = createMemo(() => new Map(municipios().map((m) => [m.codigo, m])));
  const comVoto = createMemo(() => municipios().filter((m) => m.votos > 0).length);
  const totalVista = createMemo(() => (cidade() ? municipios().reduce((s, m) => s + m.votos, 0) : candidato().votos));
  const escopo = () => (cidade() ? 'área' : 'município');

  function atualizarUrl() {
    const url = new URL(location.href);
    url.searchParams.set('partido', partido());
    url.searchParams.set('cargo', codigoCargo());
    url.searchParams.set('candidato', numero());
    if (cidade()) url.searchParams.set('municipio', cidade().codigo);
    else url.searchParams.delete('municipio');
    history.replaceState(null, '', url);
  }

  async function abrirCidade(codigo) {
    if (!CIDADES_DETALHADAS.has(codigo)) return;
    setCarregando(codigo);
    try {
      const c = await carregarCidade(codigo);
      batch(() => {
        setCidade(c);
        setRecorte('municipio'); // cada cidade abre inteira
        setFixado(null);
        setFoco(null);
        setBusca('');
      });
      atualizarUrl();
    } finally {
      setCarregando(null);
    }
  }

  function voltarAoEstado() {
    const codigo = cidade()?.codigo;
    batch(() => {
      setCidade(null);
      setFoco(null);
      setBusca('');
      setFixado(codigo ?? null);
    });
    atualizarUrl();
  }

  onMount(() => {
    const codigo = new URLSearchParams(location.search).get('municipio');
    if (codigo) abrirCidade(codigo);
  });

  function escolherCandidato(n) {
    setNumero(n);
    atualizarUrl();
  }

  function escolherCargo(codigo) {
    if (codigo === codigoCargo()) return;
    const novoCargo = cargos.find((c) => c.codigo === codigo);
    batch(() => {
      setCodigoCargo(codigo);
      setNumero(doPartido(novoCargo, partido())[0].numero);
    });
    atualizarUrl();
  }

  function escolherPartido(p) {
    if (p === partido()) return;
    const novoCargo = cargoComPartido(p, cargo());
    batch(() => {
      setPartido(p);
      setCodigoCargo(novoCargo.codigo);
      setNumero(doPartido(novoCargo, p)[0].numero);
    });
    atualizarUrl();
  }

  const valor = (m) => m[medida()];
  const ordenados = createMemo(() => {
    const k = medida();
    return [...municipios()].sort((a, b) => b[k] - a[k] || b.votos - a.votos);
  });
  const maximo = createMemo(() => valor(ordenados()[0]));
  // Menor valor positivo da medida: âncora da escala log (1 para votos).
  const unidade = createMemo(() => {
    const k = medida();
    return municipios().reduce((min, m) => (m[k] > 0 && m[k] < min ? m[k] : min), Infinity);
  });
  const posicaoNoRanking = createMemo(() => new Map(ordenados().map((m, i) => [m.codigo, i + 1])));
  const cores = createMemo(() => {
    const [k, max, e, u] = [medida(), maximo(), escala(), unidade()];
    return Object.fromEntries(municipios().map((m) => [m.codigo, cor(posicao(m[k], max, e, u))]));
  });

  const selecionado = () => porCodigo().get(fixado() ?? foco());
  const fixar = (codigo) => setFixado((atual) => (codigo && codigo !== atual ? codigo : null));

  function buscar(texto) {
    setBusca(texto);
    const alvo = fmt.normalizar(texto);
    const achado = alvo && municipios().find((m) => fmt.normalizar(m.nome) === alvo);
    if (achado) setFixado(achado.codigo);
  }

  return (
    <div class="pagina">
      <header class="topo">
        <div class="linha-topo">
          <p class="marca">Geopainel</p>
          <div class="seletores">
            <Alternador rotulo="Partido" opcoes={OPCOES_PARTIDO} valor={partido()} onEscolher={escolherPartido} />
            <Alternador
              rotulo="Cargo"
              opcoes={OPCOES_CARGO}
              valor={codigoCargo()}
              onEscolher={escolherCargo}
              desabilitadas={cargosSemPartido()}
              motivo={`Sem opções do ${fmt.partido(partido())} neste cargo`}
            />
            <label class="seletor">
              <span>Candidatura</span>
              <select value={numero()} onChange={(e) => escolherCandidato(e.currentTarget.value)}>
                <For each={opcoes()}>
                  {(c) => (
                    <option value={c.numero}>
                      {fmt.temNumero(c) ? `${fmt.titulo(c)} — ${c.numero}` : fmt.titulo(c)}
                    </option>
                  )}
                </For>
              </select>
            </label>
          </div>
        </div>
        <h1>
          {fmt.titulo(candidato())}{' '}
          <Show when={fmt.temNumero(candidato())}>
            <span class="numero">{candidato().numero}</span>
          </Show>
        </h1>
        <p class="sub">
          {[
            candidato().cargo,
            candidato().partido !== 'N/A' && fmt.partido(candidato().partido),
            'Rio Grande do Sul',
            fonte.eleicao,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <dl class="numeros">
          <div>
            <dt>
              {candidato().numero === 'ausentes' ? 'Ausentes' : candidato().tipo === 'total' ? 'Total' : 'Votos'}{' '}
              {cidade() ? `em ${cidade().nome}` : 'no estado'}
            </dt>
            <dd>{fmt.votos(totalVista())}</dd>
          </div>
          <div>
            <dt>{base().curto}</dt>
            <dd>{fmt.pct(cidade() ? (candidato().municipios[cidade().codigo]?.pct ?? 0) : candidato().pct)}</dd>
          </div>
          <div>
            <dt>
              {cidade()
                ? cidade().temInterior
                  ? 'Bairros e distritos com voto'
                  : 'Bairros com voto'
                : 'Municípios com voto'}
            </dt>
            <dd>
              {comVoto()} <small>de {municipios().length}</small>
            </dd>
          </div>
          <div>
            <dt>{candidato().tipo === 'candidatura' ? 'Situação' : 'Tipo'}</dt>
            <dd class="situacao">{candidato().situacao}</dd>
          </div>
        </dl>
      </header>

      <main class="corpo">
        <section class="area-mapa" aria-label="Mapa de calor">
          <Show when={cidade()}>
            {(c) => (
              <div class="faixa-cidade">
                <p>
                  <strong>{c().nome}</strong> por bairro ·{' '}
                  <span class="fraco">
                    {fmt.votos(c().unidades.reduce((s, u) => s + u.urnas, 0))} urnas em {c().locais.length} locais de
                    votação (pontos)
                  </span>
                </p>
                <div class="acoes-cidade">
                  <Show when={c().temInterior}>
                    <Alternador rotulo="Recorte" opcoes={RECORTES} valor={recorte()} onEscolher={setRecorte} />
                  </Show>
                  <button type="button" class="botao" onClick={voltarAoEstado}>
                    ← Mapa do RS
                  </button>
                </div>
              </div>
            )}
          </Show>
          <div class="controles">
            <Alternador
              rotulo="Medida"
              opcoes={Object.fromEntries(Object.keys(MEDIDAS).map((k) => [k, med(k).rotulo]))}
              valor={medida()}
              onEscolher={setMedida}
            />
            <Alternador rotulo="Escala" opcoes={ESCALAS} valor={escala()} onEscolher={setEscala} />
          </div>
          <Mapa
            formas={vistaCidade()?.formas ?? formas}
            pontos={vistaCidade()?.pontos}
            cores={cores()}
            largura={vistaCidade()?.largura ?? projecao.largura}
            altura={vistaCidade()?.altura ?? projecao.altura}
            foco={foco()}
            fixado={fixado()}
            onFoco={setFoco}
            onFixar={fixar}
            dados={(c) => porCodigo().get(c)}
            contagem={(n) => fmt.contagem(candidato(), n)}
            dicaPct={base().dica}
            rotulo={
              cidade()
                ? `Mapa de ${cidade().nome} com ${fmt.descricao(candidato())} por bairro. Use a busca ou o ranking para consultar um bairro.`
                : `Mapa do Rio Grande do Sul com ${fmt.descricao(candidato())} por município. Use a busca ou o ranking para consultar um município.`
            }
          />
          <Legenda
            maximo={maximo()}
            escala={escala()}
            unidade={unidade()}
            formatar={med(medida()).formatar}
            titulo={`${med(medida()).titulo(cargo(), escopo())} — escala ${ESCALAS[escala()].toLowerCase()}`}
          />
        </section>

        <aside class="painel">
          <label class="busca">
            <span>{cidade() ? 'Buscar bairro ou distrito' : 'Buscar município'}</span>
            <input
              type="search"
              list="lista-municipios"
              placeholder={cidade() ? 'Ex.: Centro' : 'Ex.: Pelotas'}
              value={busca()}
              onInput={(e) => buscar(e.currentTarget.value)}
            />
            <datalist id="lista-municipios">
              <For each={[...municipios()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))}>
                {(m) => <option value={m.nome} />}
              </For>
            </datalist>
          </label>

          <section class="cartao" aria-live="polite">
            <Show
              when={selecionado()}
              fallback={
                <p class="fraco">Passe o mouse ou toque num {cidade() ? 'bairro' : 'município'} para ver os números.</p>
              }
            >
              {(m) => (
                <>
                  <header>
                    <h2>
                      {m().nome}
                      <Show when={m().setor}>{(setor) => <small class="fraco"> · {setor()}</small>}</Show>
                    </h2>
                    <Show when={fixado()}>
                      <button type="button" class="fechar" onClick={() => setFixado(null)} aria-label="Soltar seleção">
                        ×
                      </button>
                    </Show>
                  </header>
                  <div class="destaques">
                    <span class="amostra" style={{ background: cores()[m().codigo] }} />
                    <p>
                      <strong>{fmt.votos(m().votos)}</strong> {fmt.contagem(candidato(), m().votos)}
                    </p>
                  </div>
                  <dl>
                    <dt>
                      {base().curto} {ONDE[m().tipo]}
                    </dt>
                    <dd>{fmt.pct(m().pct)}</dd>
                    <dt>A cada 100 eleitores</dt>
                    <dd>{fmt.proporcao(m().prop)}</dd>
                    <dt>Eleitores {ONDE[m().tipo]}</dt>
                    <dd>{fmt.votos(m().eleitores)}</dd>
                    <dt>Votos válidos ({cargo().rotulo.toLowerCase()})</dt>
                    <dd>{fmt.votos(m().validos)}</dd>
                    <Show when={cidade()}>
                      <dt>Urnas (seções)</dt>
                      <dd>{fmt.votos(m().urnas)}</dd>
                      <dt>Locais de votação</dt>
                      <dd>{fmt.votos(m().locais)}</dd>
                    </Show>
                    <dt>{cidade() ? `Parcela da votação em ${cidade().nome}` : 'Parcela da votação total'}</dt>
                    <dd>{fmt.pct(totalVista() ? (m().votos / totalVista()) * 100 : 0)}</dd>
                    <dt>Posição ({med(medida()).nome})</dt>
                    <dd>
                      {posicaoNoRanking().get(m().codigo)}º de {municipios().length}
                    </dd>
                  </dl>
                  <Show when={!cidade() && CIDADES_DETALHADAS.has(m().codigo)}>
                    <button
                      type="button"
                      class="botao principal"
                      disabled={carregando() === m().codigo}
                      onClick={() => abrirCidade(m().codigo)}
                    >
                      {carregando() === m().codigo ? 'Carregando…' : 'Mapa Municipal'}
                    </button>
                  </Show>
                </>
              )}
            </Show>
          </section>

          <section class="ranking">
            <h2>Maiores por {med(medida()).nome}</h2>
            <ol>
              <For each={ordenados().slice(0, NO_RANKING)}>
                {(m) => (
                  <li>
                    <button type="button" aria-pressed={fixado() === m.codigo} onClick={() => fixar(m.codigo)}>
                      <span class="amostra" style={{ background: cores()[m.codigo] }} />
                      <span class="nome">{m.nome}</span>
                      <span class="valor">{med(medida()).formatar(valor(m))}</span>
                    </button>
                  </li>
                )}
              </For>
            </ol>
          </section>
        </aside>
      </main>

      <footer class="rodape">
        <p>
          Fontes: TSE — resultado oficial, totalização {fonte.totalizacao}, gerado em {fonte.geradoEm}; IBGE — malha
          municipal e nomes. Dados embutidos em JSON no próprio front-end.
          <Show when={cidade()}>
            {(c) => <> Mapa municipal: TSE — votação por seção e locais de votação; {c().fonte.contornos}.</>}
          </Show>
        </p>
      </footer>
    </div>
  );
}
