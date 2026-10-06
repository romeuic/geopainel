import { For } from 'solid-js';
import { cor, valorEm } from './escala.js';

const PARADAS = Array.from({ length: 11 }, (_, i) => i / 10);
const MARCAS = [0, 0.25, 0.5, 0.75, 1];
const GRADIENTE = `linear-gradient(to right, ${PARADAS.map((t) => `${cor(t)} ${t * 100}%`).join(', ')})`;

export default function Legenda(props) {
  return (
    <figure class="legenda">
      <div class="barra" style={{ 'background-image': GRADIENTE }} />
      <ol class="marcas">
        <For each={MARCAS}>
          {(t) => (
            <li style={{ left: `${t * 100}%` }}>
              {props.formatar(valorEm(t, props.maximo, props.escala, props.unidade))}
            </li>
          )}
        </For>
      </ol>
      <figcaption>{props.titulo}</figcaption>
    </figure>
  );
}
