import { createMemo, createSignal, For, Show } from 'solid-js';
import malha from './dados/municipios-rs.geo.json';
import resultado from './dados/votos.json';
import Mapa from './Mapa.jsx';
import Legenda from './Legenda.jsx';
import { cor, posicao } from './escala.js';
import { criarProjecao } from './projecao.js';
import * as fmt from './formato.js';

const { candidatos, fonte } = resultado;
const projecao = criarProjecao(malha, 1000);

// Formas e dados que não mudam com o candidato.
const formas = malha.features
  .map((f) => ({
    codigo: f.properties.codigo,
    nome: f.properties.nome,
    d: projecao.caminho(f),
    validos: resultado.municipios[f.properties.codigo]?.validos ?? 0,
  }))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

const SEM_VOTO = { votos: 0, pct: 0 };

// Candidato inicial vem de ?candidato=<número>, para o link ser compartilhável.
function candidatoDaUrl() {
  const numero = new URLSearchParams(location.search).get('candidato');
  return candidatos.some((c) => c.numero === numero) ? numero : candidatos[0].numero;
}

const MEDIDAS = {
  votos: { rotulo: 'Votos', titulo: 'Votos no município', formatar: fmt.votos },
  pct: { rotulo: '% dos válidos', titulo: 'Percentual dos votos válidos para deputado estadual', formatar: fmt.pct },
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
  const [numero, setNumero] = createSignal(candidatoDaUrl());
  const [medida, setMedida] = createSignal('votos');
  const [escala, setEscala] = createSignal('log');
  const [foco, setFoco] = createSignal(null);
  const [fixado, setFixado] = createSignal(null);
  const [busca, setBusca] = createSignal('');

  const candidato = createMemo(() => candidatos.find((c) => c.numero === numero()));
  const municipios = createMemo(() => {
    const votos = candidato().municipios;
    return formas.map((f) => ({ ...f, ...(votos[f.codigo] ?? SEM_VOTO) }));
  });
  const porCodigo = createMemo(() => new Map(municipios().map((m) => [m.codigo, m])));
  const comVoto = createMemo(() => Object.keys(candidato().municipios).length);

  function escolherCandidato(n) {
    setNumero(n);
    const url = new URL(location.href);
    url.searchParams.set('candidato', n);
    history.replaceState(null, '', url);
  }

  const valor = (m) => m[medida()];
  const ordenados = createMemo(() => {
    const k = medida();
    return [...municipios()].sort((a, b) => b[k] - a[k] || b.votos - a.votos);
  });
  const maximo = createMemo(() => valor(ordenados()[0]));
  const posicaoNoRanking = createMemo(() => new Map(ordenados().map((m, i) => [m.codigo, i + 1])));
  const cores = createMemo(() => {
    const [k, max, e] = [medida(), maximo(), escala()];
    return Object.fromEntries(municipios().map((m) => [m.codigo, cor(posicao(m[k], max, e))]));
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
          <label class="seletor">
            <span>Candidato</span>
            <select value={numero()} onChange={(e) => escolherCandidato(e.currentTarget.value)}>
              <For each={candidatos}>
                {(c) => (
                  <option value={c.numero}>
                    {fmt.nomeProprio(c.nomeUrna)} — {c.numero}
                  </option>
                )}
              </For>
            </select>
          </label>
        </div>
        <h1>
          {fmt.nomeProprio(candidato().nomeUrna)} <span class="numero">{candidato().numero}</span>
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
          <div>
            <dt>Situação</dt>
            <dd class="situacao">{candidato().situacao}</dd>
          </div>
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
            rotulo={`Mapa do Rio Grande do Sul com os votos de ${fmt.nomeProprio(candidato().nomeUrna)} por município. Use a busca ou o ranking para consultar um município.`}
          />
          <Legenda
            maximo={maximo()}
            escala={escala()}
            formatar={MEDIDAS[medida()].formatar}
            titulo={`${MEDIDAS[medida()].titulo} — escala ${ESCALAS[escala()].toLowerCase()}`}
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
                    <dt>Votos válidos (dep. estadual)</dt>
                    <dd>{fmt.votos(m().validos)}</dd>
                    <dt>Parcela do total do candidato</dt>
                    <dd>{fmt.pct((m().votos / candidato().votos) * 100)}</dd>
                    <dt>Posição ({MEDIDAS[medida()].rotulo.toLowerCase()})</dt>
                    <dd>
                      {posicaoNoRanking().get(m().codigo)}º de {formas.length}
                    </dd>
                  </dl>
                </>
              )}
            </Show>
          </section>

          <section class="ranking">
            <h2>Maiores por {MEDIDAS[medida()].rotulo.toLowerCase()}</h2>
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
