# Geopainel

Mapa de calor dos votos para deputado estadual em cada um dos 497 municípios
do Rio Grande do Sul — Eleições 2026, 1º turno (04/10/2026). Azul-escuro =
0 votos; vermelho nítido = maior votação do candidato escolhido.

Candidatos no seletor: **Humberto Matos (65065, PCdoB)**, **Giovani Culau
(65656, PCdoB)** e **Erick Denil (65444, PCdoB)**. O candidato fica na URL (`?candidato=65656`), então o link
pode ser compartilhado.

Solid + Vite, sem backend: todos os dados vivem em JSON dentro de `src/dados/`.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5190
npm test         # escala de cor e projeção
npm run build    # gera dist/ estático
```

## Dados

| arquivo                            | conteúdo                                                                                                                                                                                  | fonte                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `src/dados/votos.json`             | `municipios` (por código IBGE: `validos`, `secoes` % totalizadas) e `candidatos[]` com totais e, por código IBGE, `votos` e `pct` (dos válidos no município); município ausente = 0 votos | TSE, `resultados.tse.jus.br`, eleição 6259, cargo 7 |
| `src/dados/municipios-rs.geo.json` | GeoJSON dos municípios (`codigo` IBGE, `nome`), coordenadas em 3 casas                                                                                                                    | IBGE, API de malhas v3, qualidade intermediária     |

Para regenerar, ou para escolher quais candidatos a deputado estadual do RS
entram no seletor:

```bash
npm run dados                        # 65065, 65656 e 65444
npm run dados -- 65065 65656 13013   # lista própria, na ordem do seletor
```

O script baixa cada um dos 497 arquivos municipais do TSE uma vez só e confere,
para cada candidato, que a soma municipal bate com o total estadual.

## Como o mapa é desenhado

- **Projeção** (`src/projecao.js`): equirretangular com correção de cosseno na
  latitude média, sem bibliotecas — suficiente para o recorte do RS.
- **Cor** (`src/escala.js`): interpolação em OKLab entre `#0b1d51` e `#ff1f1f`.
- **Escala**: logarítmica por padrão, porque Porto Alegre (9.002 votos) tem
  4,6× a segunda cidade e, na linear, quase todo o estado fica azul. A linear
  continua disponível no alternador.
- **Medida**: votos absolutos ou % dos votos válidos no município.
