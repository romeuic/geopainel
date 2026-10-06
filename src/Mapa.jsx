import { createEffect, createSignal, For, on, onCleanup, onMount, Show, untrack } from 'solid-js';
import * as fmt from './formato.js';
import { aproximar, deslocar, nivel, vistaInteira } from './zoom.js';

// Deslocamento (px) a partir do qual um gesto vira arraste e deixa de ser clique.
const LIMIAR_ARRASTE = 5;
const PASSO_BOTAO = 1.6;

// Mapa SVG de áreas (municípios do estado ou bairros de uma cidade). Recebe as
// formas já projetadas e a cor de cada uma; hover mostra a dica, clique fixa a
// área no painel. `pontos` (opcional) marca os locais de votação.
// Zoom: roda do mouse, pinça ou botões; arraste move o mapa aproximado.
export default function Mapa(props) {
  const [dica, setDica] = createSignal(null);
  // Valor inicial; o efeito abaixo acompanha as trocas de desenho.
  const [vista, setVista] = createSignal(untrack(() => vistaInteira(props.largura, props.altura)));
  const [arrastando, setArrastando] = createSignal(false);
  let caixa;
  let svg;

  // Outro desenho (estado, cidade, recorte): volta à vista inteira.
  createEffect(
    on([() => props.largura, () => props.altura, () => props.formas], () =>
      setVista(vistaInteira(props.largura, props.altura)),
    ),
  );

  const zoom = () => nivel(vista(), props.largura);
  const aproximado = () => zoom() > 1.001;
  const viewBox = () => {
    const v = vista();
    return `${v.x} ${v.y} ${v.w} ${v.h}`;
  };

  // Ponto da tela → coordenadas do desenho.
  function noDesenho(clienteX, clienteY) {
    const r = svg.getBoundingClientRect();
    const v = vista();
    return [v.x + ((clienteX - r.left) / r.width) * v.w, v.y + ((clienteY - r.top) / r.height) * v.h];
  }

  const zoomEm = (fator, ponto) => setVista(aproximar(vista(), fator, ponto, props.largura, props.altura));
  const zoomNoCentro = (fator) => {
    const v = vista();
    zoomEm(fator, [v.x + v.w / 2, v.y + v.h / 2]);
  };

  // Roda: aproxima no cursor. Afastando já na vista inteira, deixa a página rolar.
  onMount(() => {
    const roda = (e) => {
      const fator = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      if (fator < 1 && !aproximado()) return;
      e.preventDefault();
      zoomEm(fator, noDesenho(e.clientX, e.clientY));
    };
    svg.addEventListener('wheel', roda, { passive: false });
    onCleanup(() => svg.removeEventListener('wheel', roda));
  });

  // Gestos: um ponteiro arrasta (se aproximado), dois fazem pinça.
  const ponteiros = new Map();
  let gesto = null;
  let ignorarClique = false;

  function iniciarGesto() {
    const pts = [...ponteiros.values()];
    if (pts.length === 1) gesto = { tipo: 'arraste', inicio: pts[0], vista: vista(), moveu: false };
    else if (pts.length === 2) {
      const [a, b] = pts;
      gesto = {
        tipo: 'pinca',
        distancia: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        centro: noDesenho((a.x + b.x) / 2, (a.y + b.y) / 2),
        vista: vista(),
      };
    } else gesto = null;
  }

  function apertar(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!ponteiros.size) ignorarClique = false; // gesto novo
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    iniciarGesto();
  }

  function soltar(e) {
    if (!ponteiros.delete(e.pointerId)) return;
    if (gesto?.moveu || gesto?.tipo === 'pinca') ignorarClique = true;
    setArrastando(false);
    iniciarGesto();
  }

  function mover(e) {
    if (ponteiros.has(e.pointerId)) ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesto?.tipo === 'pinca' && ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      const fator = Math.hypot(a.x - b.x, a.y - b.y) / gesto.distancia;
      setVista(aproximar(gesto.vista, fator, gesto.centro, props.largura, props.altura));
      setDica(null);
      return;
    }

    if (gesto?.tipo === 'arraste' && ponteiros.has(e.pointerId)) {
      const dx = e.clientX - gesto.inicio.x;
      const dy = e.clientY - gesto.inicio.y;
      if (!gesto.moveu && aproximado() && Math.hypot(dx, dy) > LIMIAR_ARRASTE) {
        gesto.moveu = true;
        setArrastando(true);
        svg.setPointerCapture(e.pointerId);
        setDica(null);
        props.onFoco(null);
      }
      if (gesto.moveu) {
        const escala = gesto.vista.w / svg.getBoundingClientRect().width;
        setVista(deslocar(gesto.vista, dx * escala, dy * escala, props.largura, props.altura));
        return;
      }
    }

    const codigo = e.target?.dataset?.codigo;
    props.onFoco(codigo ?? null);
    if (!codigo || e.pointerType !== 'mouse') return setDica(null);
    const r = caixa.getBoundingClientRect();
    setDica({ codigo, x: e.clientX - r.left, y: e.clientY - r.top, largura: r.width });
  }

  function sair() {
    if (arrastando()) return;
    props.onFoco(null);
    setDica(null);
  }

  function clicar(e) {
    if (ignorarClique) {
      ignorarClique = false;
      return;
    }
    props.onFixar(e.target?.dataset?.codigo ?? null);
  }

  const destaque = (codigo) => (codigo ? props.formas.find((f) => f.codigo === codigo)?.d : null);

  return (
    <div class="mapa" ref={(el) => (caixa = el)}>
      <svg
        ref={(el) => (svg = el)}
        viewBox={viewBox()}
        role="img"
        aria-label={props.rotulo}
        classList={{ aproximado: aproximado(), arrastando: arrastando() }}
        onPointerDown={apertar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onPointerLeave={sair}
        onClick={clicar}
      >
        <g class="municipios">
          <For each={props.formas}>{(f) => <path d={f.d} data-codigo={f.codigo} fill={props.cores[f.codigo]} />}</For>
        </g>
        <Show when={props.pontos}>
          {/* Os pontos crescem menos que o mapa, para não cobrir os bairros no zoom. */}
          <g class="locais" aria-hidden="true">
            <For each={props.pontos}>{(p) => <circle cx={p.x} cy={p.y} r={p.r / Math.sqrt(zoom())} />}</For>
          </g>
        </Show>
        <Show when={destaque(props.foco)}>{(d) => <path class="contorno foco" d={d()} />}</Show>
        <Show when={destaque(props.fixado)}>{(d) => <path class="contorno fixado" d={d()} />}</Show>
      </svg>
      <div class="zoom" role="group" aria-label="Zoom do mapa">
        <button type="button" onClick={() => zoomNoCentro(PASSO_BOTAO)} aria-label="Aproximar" title="Aproximar">
          +
        </button>
        <button
          type="button"
          onClick={() => zoomNoCentro(1 / PASSO_BOTAO)}
          disabled={!aproximado()}
          aria-label="Afastar"
          title="Afastar"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setVista(vistaInteira(props.largura, props.altura))}
          disabled={!aproximado()}
          aria-label="Mostrar o mapa inteiro"
          title="Mostrar o mapa inteiro"
        >
          ⤢
        </button>
      </div>
      <Show when={dica()}>
        {(t) => {
          const m = () => props.dados(t().codigo);
          return (
            <div
              class="dica"
              classList={{ esquerda: t().x > t().largura * 0.6 }}
              style={{ left: `${t().x}px`, top: `${t().y}px` }}
              aria-hidden="true"
            >
              <strong>{m().nome}</strong>
              <span>
                {fmt.votos(m().votos)} {props.contagem(m().votos)}
              </span>
              <span class="fraco">
                {fmt.pct(m().pct)} {props.dicaPct}
              </span>
            </div>
          );
        }}
      </Show>
    </div>
  );
}
