import { createSignal, For, Show } from 'solid-js';
import * as fmt from './formato.js';

// Mapa SVG de áreas (municípios do estado ou bairros de uma cidade). Recebe as
// formas já projetadas e a cor de cada uma; hover mostra a dica, clique fixa a
// área no painel. `pontos` (opcional) marca os locais de votação.
export default function Mapa(props) {
  const [dica, setDica] = createSignal(null);
  let caixa;

  const codigoDoEvento = (e) => e.target?.dataset?.codigo;

  function mover(e) {
    const codigo = codigoDoEvento(e);
    props.onFoco(codigo ?? null);
    if (!codigo || e.pointerType !== 'mouse') return setDica(null);
    const r = caixa.getBoundingClientRect();
    setDica({ codigo, x: e.clientX - r.left, y: e.clientY - r.top, largura: r.width });
  }

  function sair() {
    props.onFoco(null);
    setDica(null);
  }

  const destaque = (codigo) => (codigo ? props.formas.find((f) => f.codigo === codigo)?.d : null);

  return (
    <div class="mapa" ref={(el) => (caixa = el)}>
      <svg
        viewBox={`0 0 ${props.largura} ${props.altura}`}
        role="img"
        aria-label={props.rotulo}
        onPointerMove={mover}
        onPointerLeave={sair}
        onClick={(e) => props.onFixar(codigoDoEvento(e) ?? null)}
      >
        <g class="municipios">
          <For each={props.formas}>{(f) => <path d={f.d} data-codigo={f.codigo} fill={props.cores[f.codigo]} />}</For>
        </g>
        <Show when={props.pontos}>
          <g class="locais" aria-hidden="true">
            <For each={props.pontos}>{(p) => <circle cx={p.x} cy={p.y} r={p.r} />}</For>
          </g>
        </Show>
        <Show when={destaque(props.foco)}>{(d) => <path class="contorno foco" d={d()} />}</Show>
        <Show when={destaque(props.fixado)}>{(d) => <path class="contorno fixado" d={d()} />}</Show>
      </svg>
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
