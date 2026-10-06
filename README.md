# Geopainel

Mapa de calor dos votos para deputado estadual e deputado federal em cada um
dos 497 municípios do Rio Grande do Sul — Eleições 2026, 1º turno (04/10/2026).
Azul-escuro = 0 votos; vermelho nítido = maior votação da opção escolhida.

Seletores de partido, cargo e candidatura:

- **PCdoB**
  - **Dep. Estadual:** Humberto Matos (65065), Giovani Culau (65656), Erick
    Denil (65444), Nilvo Riboldi (65653), Sandra Picoli (65123), Professora
    Bilina (65651) e os votos na legenda (65) — voto só no partido.
  - **Dep. Federal:** Daiana Santos (6565), Tonhão dos Santos (6500) e os
    votos na legenda (65).
- **PT**
  - **Dep. Federal:** Naiton Gama (1330) e Valdeci Oliveira (1307).

A lista de partidos sai dos dados (sigla do TSE de cada opção); um cargo sem
opção do partido escolhido fica desabilitado. A seleção fica na URL
(`?partido=PT&cargo=federal&candidato=1330`), então o link pode ser
compartilhado; só `?candidato=…` também basta.

Solid + Vite, sem backend: todos os dados vivem em JSON dentro de `src/dados/`.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5190
npm test         # escala de cor e projeção
npm run build    # gera dist/ estático
```

## Dados

| arquivo                            | conteúdo                                                                                                                                                                                                                               | fonte                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/dados/votos.json`             | `cargos[]`, um por cargo: `municipios` (por código IBGE: `eleitores` aptos, `validos`, `secoes` % totalizadas) e `candidatos[]` com totais e, por código IBGE, `votos` e `pct` (dos válidos no município); município ausente = 0 votos | TSE, `resultados.tse.jus.br`, eleição 6259, cargos 7 (estadual) e 6 (federal) |
| `src/dados/municipios-rs.geo.json` | GeoJSON dos municípios (`codigo` IBGE, `nome`), coordenadas em 3 casas                                                                                                                                                                 | IBGE, API de malhas v3, qualidade intermediária                               |

Para regenerar, ou para escolher o que entra nos seletores:

```bash
npm run dados                                             # as opções atuais
npm run dados -- estadual 65065 65123:f 65 federal 6565:f # lista própria
```

- A palavra `estadual` ou `federal` vale para os números que a seguem; a
  ordem dos números é a ordem do seletor.
- Um número de 2 dígitos (ex.: `65`) traz os votos na legenda do partido; o
  percentual é calculado sobre os válidos do município, como o TSE faz para os
  nominais.
- O sufixo `:f` marca candidata, para o cargo e a situação saírem no feminino
  ("Deputada", "Eleita"): o resultado do TSE não informa gênero.

O script baixa cada um dos 497 arquivos municipais do TSE uma vez por cargo e
confere, para cada opção, que a soma municipal bate com o total estadual.

## Como o mapa é desenhado

- **Projeção** (`src/projecao.js`): equirretangular com correção de cosseno na
  latitude média, sem bibliotecas — suficiente para o recorte do RS.
- **Cor** (`src/escala.js`): interpolação em OKLab entre `#0b1d51` e `#ff1f1f`.
- **Escala**: logarítmica por padrão, porque Porto Alegre (9.002 votos) tem
  4,6× a segunda cidade e, na linear, quase todo o estado fica azul. A linear
  continua disponível no alternador. A log usa log(1 + v/u), com u = menor
  valor positivo da medida (1 para votos): sem isso, frações pequenas como a
  medida "A cada 100" ficariam numa escala praticamente linear.
- **Medida**: votos absolutos, % dos votos válidos no município, ou
  **A cada 100** — quantos eleitores aptos do município votaram na opção a
  cada 100 (de 0 a 100; ex.: 1,49 = 1,49 pessoa a cada 100). Mede o alcance
  sobre todo o eleitorado, incluindo quem se absteve, votou em branco ou nulo.
