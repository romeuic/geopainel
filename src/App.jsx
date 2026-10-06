import { batch, createMemo, createSignal, For, Show } from 'solid-js';
import malha from './dados/municipios-rs.geo.json';
import resultado from './dados/votos.json';
import Mapa from './Mapa.jsx';
import Legenda from './Legenda.jsx';
import { cor, posicao } from './escala.js';
import { criarProjecao } from './projecao.js';
import * as fmt from './formato.js';

const { cargos, fonte } = resultado;
const projecao = criarProjecao(malha, 1000);

// Formas que não mudam com cargo nem candidato.
const formas = malha.features
  .map((f) => ({ codigo: f.properties.codigo, nome: f.properties.nome, d: projecao.caminho(f) }))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

const SEM_VOTO = { votos: 0, pct: 0 };
const OPCOES_CARGO = Object.fromEntries(cargos.map((c) => [c.codigo, c.rotulo]));

// Partidos na ordem em que aparecem nos dados; sigla do TSE → nome de exibição.
const PARTIDOS = [...new Set(cargos.flatMap((c) => c.candidatos.map((x) => x.partido)))];
const OPCOES_PARTIDO = Object.fromEntries(PARTIDOS.map((p) => [p, fmt.partido(p)]));

const doPartido = (cargo, partido) => cargo.candidatos.filter((c) => c.partido === partido);
// O cargo preferido, se tiver opção do partido; senão o primeiro que tenha.
const cargoComPartido = (partido, preferido) =>
  preferido && doPartido(preferido, partido).length ? preferido : cargos.find((c) => doPartido(c, partido).length);

// Seleção inicial vem de ?partido=…&cargo=…&candidato=…, para o link ser
// compartilhável. O número manda: partido e cargo são os dele; sem cargo na URL,
// vale o primeiro cargo onde o número existe (a legenda "65" existe nos dois).
function selecaoDaUrl() {
  const busca = new URLSearchParams(location.search);
  const numero = busca.get('candidato');
  const temNumero = (c) => c.candidatos.some((x) => x.numero === numero);
  const doCargo = cargos.find((c) => c.codigo === busca.get('cargo'));
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
  votos: { rotulo: 'Votos', nome: 'votos', titulo: () => 'Votos no município', formatar: fmt.votos },
  pct: {
    rotulo: '% dos válidos',
    nome: '% dos válidos',
    titulo: (cargo) => `Percentual dos votos válidos para ${cargo.nome.toLowerCase()}`,
    formatar: fmt.pct,
  },
  prop: {
    rotulo: 'A cada 100',
    nome: 'eleitores a cada 100',
    titulo: () => 'Eleitores do município que votaram nesta opção, a cada 100 (de 0 a 100)',
    formatar: fmt.proporcao,
  },
};
const ESCALAS = { log: 'Logarítmica', linear: 'Linear' };
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

  const cargo = createMemo(() => cargos.find((c) => c.codigo === codigoCargo()));
  const opcoes = createMemo(() => doPartido(cargo(), partido()));
  const candidato = createMemo(() => opcoes().find((c) => c.numero === numero()));
  const cargosSemPartido = createMemo(
    () => new Set(cargos.filter((c) => !doPartido(c, partido()).length).map((c) => c.codigo)),
  );
  const municipios = createMemo(() => {
    const votos = candidato().municipios;
    const base = cargo().municipios;
    return formas.map((f) => {
      const { eleitores = 0, validos = 0 } = base[f.codigo] ?? {};
      const v = votos[f.codigo] ?? SEM_VOTO;
      return { ...f, eleitores, validos, ...v, prop: eleitores ? (v.votos / eleitores) * 100 : 0 };
    });
  });
  const porCodigo = createMemo(() => new Map(municipios().map((m) => [m.codigo, m])));
  const comVoto = createMemo(() => Object.keys(candidato().municipios).length);

  function atualizarUrl() {
    const url = new URL(location.href);
    url.searchParams.set('partido', partido());
    url.searchParams.set('cargo', codigoCargo());
    url.searchParams.set('candidato', numero());
    history.replaceState(null, '', url);
  }

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
    const achado = alvo && formas.find((m) => fmt.normalizar(m.nome) === alvo);
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
                      {fmt.titulo(c)} — {c.numero}
                    </option>
                  )}
                </For>
              </select>
            </label>
          </div>
        </div>
        <h1>
          {fmt.titulo(candidato())} <span class="numero">{candidato().numero}</span>
        </h1>
        <p class="sub">
          {candidato().cargo} · {fmt.partido(candidato().partido)} · Rio Grande do Sul · {fonte.eleicao}
        </p>
        <dl class="numeros">
          <div>
            <dt>Votos no estado</dt>
            <dd>{fmt.votos(candidato().votos)}</dd>
          </div>
          <div>
            <dt>Dos válidos</dt>
            <dd>{fmt.pct(candidato().pct)}</dd>
          </div>
          <div>
            <dt>Municípios com voto</dt>
            <dd>
              {comVoto()} <small>de {formas.length}</small>
            </dd>
          </div>
          <Show
            when={candidato().tipo !== 'legenda'}
            fallback={
              <div>
                <dt>Tipo</dt>
                <dd class="situacao">Voto só no partido</dd>
              </div>
            }
          >
            <div>
              <dt>Situação</dt>
              <dd class="situacao">{candidato().situacao}</dd>
            </div>
          </Show>
        </dl>
      </header>

      <main class="corpo">
        <section class="area-mapa" aria-label="Mapa de calor">
          <div class="controles">
            <Alternador
              rotulo="Medida"
              opcoes={Object.fromEntries(Object.entries(MEDIDAS).map(([k, v]) => [k, v.rotulo]))}
              valor={medida()}
              onEscolher={setMedida}
            />
            <Alternador rotulo="Escala" opcoes={ESCALAS} valor={escala()} onEscolher={setEscala} />
          </div>
          <Mapa
            formas={formas}
            cores={cores()}
            largura={projecao.largura}
            altura={projecao.altura}
            foco={foco()}
            fixado={fixado()}
            onFoco={setFoco}
            onFixar={fixar}
            dados={(c) => porCodigo().get(c)}
            rotulo={`Mapa do Rio Grande do Sul com ${fmt.descricao(candidato())} por município. Use a busca ou o ranking para consultar um município.`}
          />
          <Legenda
            maximo={maximo()}
            escala={escala()}
            unidade={unidade()}
            formatar={MEDIDAS[medida()].formatar}
            titulo={`${MEDIDAS[medida()].titulo(cargo())} — escala ${ESCALAS[escala()].toLowerCase()}`}
          />
        </section>

        <aside class="painel">
          <label class="busca">
            <span>Buscar município</span>
            <input
              type="search"
              list="lista-municipios"
              placeholder="Ex.: Pelotas"
              value={busca()}
              onInput={(e) => buscar(e.currentTarget.value)}
            />
            <datalist id="lista-municipios">
              <For each={formas}>{(m) => <option value={m.nome} />}</For>
            </datalist>
          </label>

          <section class="cartao" aria-live="polite">
            <Show
              when={selecionado()}
              fallback={<p class="fraco">Passe o mouse ou toque num município para ver os números.</p>}
            >
              {(m) => (
                <>
                  <header>
                    <h2>{m().nome}</h2>
                    <Show when={fixado()}>
                      <button
                        type="button"
                        class="fechar"
                        onClick={() => setFixado(null)}
                        aria-label="Soltar município"
                      >
                        ×
                      </button>
                    </Show>
                  </header>
                  <div class="destaques">
                    <span class="amostra" style={{ background: cores()[m().codigo] }} />
                    <p>
                      <strong>{fmt.votos(m().votos)}</strong> {m().votos === 1 ? 'voto' : 'votos'}
                    </p>
                  </div>
                  <dl>
                    <dt>Dos válidos no município</dt>
                    <dd>{fmt.pct(m().pct)}</dd>
                    <dt>A cada 100 eleitores</dt>
                    <dd>{fmt.proporcao(m().prop)}</dd>
                    <dt>Eleitores no município</dt>
                    <dd>{fmt.votos(m().eleitores)}</dd>
                    <dt>Votos válidos ({cargo().rotulo.toLowerCase()})</dt>
                    <dd>{fmt.votos(m().validos)}</dd>
                    <dt>Parcela da votação total</dt>
                    <dd>{fmt.pct((m().votos / candidato().votos) * 100)}</dd>
                    <dt>Posição ({MEDIDAS[medida()].nome})</dt>
                    <dd>
                      {posicaoNoRanking().get(m().codigo)}º de {formas.length}
                    </dd>
                  </dl>
                </>
              )}
            </Show>
          </section>

          <section class="ranking">
            <h2>Maiores por {MEDIDAS[medida()].nome}</h2>
            <ol>
              <For each={ordenados().slice(0, NO_RANKING)}>
                {(m) => (
                  <li>
                    <button
                      type="button"
                      aria-pressed={fixado() === m.codigo}
                      onClick={() => fixar(m.codigo)}
                      onPointerEnter={() => setFoco(m.codigo)}
                      onPointerLeave={() => setFoco(null)}
                    >
                      <span class="amostra" style={{ background: cores()[m.codigo] }} />
                      <span class="nome">{m.nome}</span>
                      <span class="valor">{MEDIDAS[medida()].formatar(valor(m))}</span>
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
        </p>
      </footer>
    </div>
  );
}
