# Geopainel

Mapa de calor dos votos para deputado estadual, deputado federal e presidente
em cada um dos 497 municípios do Rio Grande do Sul — Eleições 2026, 1º turno (04/10/2026).
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
  - **Presidente:** Lula (13).
- **N/A** — em todo cargo: votos brancos, votos nulos e ausentes (abstenções).
  O "%" segue a base do TSE: brancos e nulos sobre o total de votos
  (comparecimento), ausentes sobre o eleitorado apto; candidaturas e legenda,
  sobre os válidos.

Cada grupo partido + cargo com mais de uma opção ganha um **Total**, que soma
as opções do grupo município a município (e bairro a bairro nos mapas
municipais). Não há Total onde o grupo tem uma opção só (PT em Presidente).
O Total do PCdoB é o total do partido (todos os candidatos + legenda); o do
PT soma só as opções listadas; o do N/A soma brancos, nulos e ausentes e usa
o eleitorado como base do "%". Calculado na página (`src/totais.js`), sem
entrar no JSON; no link, `candidato=total-pcdob`, `total-pt`, `total-na`.

A lista de partidos sai dos dados (sigla do TSE de cada opção); um cargo sem
opção do partido escolhido fica desabilitado. A seleção fica na URL
(`?partido=PT&cargo=federal&candidato=1330`; brancos, nulos e ausentes usam
`candidato=brancos|nulos|ausentes`), então o link pode ser
compartilhado; só `?candidato=…` também basta.

Sem nada na URL, o site abre em **Presidente → Votos brancos** (`INICIO` em
`src/App.jsx`).

Solid + Vite, sem backend: todos os dados vivem em JSON dentro de `src/dados/`.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5190
npm test         # escala de cor e projeção
npm run build    # gera dist/ estático
```

## Dados

| arquivo                            | conteúdo                                                                                                                                                                                                                                                                          | fonte                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/dados/votos.json`             | `cargos[]`, um por cargo: `municipios` (por código IBGE: `eleitores` aptos, `comparecimento`, `validos`, `secoes` % totalizadas) e `candidatos[]` com totais, `base` do percentual (`validos`, `votos` ou `eleitores`) e, por código IBGE, `votos` e `pct`; município ausente = 0 | TSE, `resultados.tse.jus.br`, eleição 6259, cargos 7 (estadual) e 6 (federal); eleição 6257, cargo 1 (presidente) |
| `src/dados/municipios-rs.geo.json` | GeoJSON dos municípios (`codigo` IBGE, `nome`), coordenadas em 3 casas                                                                                                                                                                                                            | IBGE, API de malhas v3, qualidade intermediária                                                                   |

Para regenerar, ou para escolher o que entra nos seletores:

```bash
npm run dados                                             # as opções atuais
npm run dados -- estadual 65065 65 federal 6565:f presidente 13 # lista própria
```

- A palavra `estadual`, `federal` ou `presidente` vale para os números que a seguem; a
  ordem dos números é a ordem do seletor.
- Um número de 2 dígitos (ex.: `65`) traz os votos na legenda do partido; o
  percentual é calculado sobre os válidos do município, como o TSE faz para os
  nominais.
- Brancos, nulos e ausentes (partido `N/A`) entram sempre, em todo cargo,
  depois dos números pedidos. Nulos = total oficial de nulos, que inclui os
  "nulos técnicos".
- O sufixo `:f` marca candidata, para o cargo e a situação saírem no feminino
  ("Deputada", "Eleita"): o resultado do TSE não informa gênero.

O script baixa cada um dos 497 arquivos municipais do TSE uma vez por cargo e
confere, para cada opção, que a soma municipal bate com o total estadual.

## Mapa municipal (por bairro)

Cidades com dados por bairro ganham o botão **Mapa Municipal** no card, e o
mapa mostra os bairros com os locais de votação como pontos:

- **Passo Fundo** (`?municipio=4314100`): os 22 bairros (setores da Lei
  Municipal Complementar 143/2005), os 6 distritos do interior e o restante do
  distrito-sede. O mapa abre no município inteiro; "Zona urbana" aproxima nos bairros. Contornos do OpenStreetMap.
- **Porto Alegre** (`?municipio=4314902`): os 94 bairros oficiais (Lei
  12.112/2016), 344 locais, 3.077 urnas. Contornos da malha de bairros do IBGE
  (Censo 2022).
- **Caxias do Sul** (`?municipio=4305108`): 65 bairros da área urbana, 6
  distritos do interior e o restante do distrito-sede; 168 locais, 1.125
  urnas. Bairros e distritos das malhas do IBGE (Censo 2022).
- **Canoas** (`?municipio=4304606`): 18 bairros, 91 locais, 760 urnas; cidade
  toda urbana. Contornos da malha de bairros do IBGE (Censo 2022).
- **Santa Maria** (`?municipio=4316907`): 41 bairros da área urbana, 9
  distritos do interior e o restante do distrito-sede; 115 locais, 636 urnas.
  Bairros e distritos das malhas do IBGE (Censo 2022).
- **Gravataí** (`?municipio=4309209`): só os 5 distritos oficiais do IBGE
  (a sede, Barro Vermelho, Ipiranga, Itacolomi e Morungava); 77 locais, 539
  urnas. Não há bairros oficiais publicados (nem IBGE, nem OSM, nem
  geoportal), e a cidade não usa contornos estimados — a sede reúne 503 urnas.
- **Pelotas** (`?municipio=4314407`): as 7 regiões administrativas (Centro,
  Fragata, Três Vendas, Areal, São Gonçalo, Laranjal / Z3, Barragem) — o que o
  TSE usa como bairro — e os 8 distritos do interior; 114 locais, 757 urnas.
  Regiões do OpenStreetMap (o IBGE não tem bairros de Pelotas), distritos do
  IBGE. O TSE cadastra o interior como "2º Distrito"… "9º Distrito"; a
  correspondência com os nomes está em `apelidos`.
- **Dona Francisca** (`?municipio=4306700`): as 12 comunidades rurais
  (Sanga Funda, Linha Ávila, Vila Alegre, Trombudo, Formoso, Linha dos
  Dambrós, Passo dos Ropke, Linha do Moinho, Retorcida, Linha Grande, Linha do
  Soturno e Central e Acácio Flores, que no mapa de origem dividem um
  polígono); 7 locais, 11 urnas. Não há bairros no IBGE nem no OSM e o
  município tem um distrito só: as divisas vêm da Figura 1 de Reck, Dorr,
  Ceretta e Dalla Valle, _Produtos orgânicos e artesanais nas festas de
  comunidade_, Estudo & Debate 33(2), 2026 (CC BY-NC 4.0), vetorizada em
  `scripts/contornos/4306700.geo.json`. O CCD Pinheirão, cadastrado no TSE
  em "Linha Grande", fica pelas coordenadas em Passo dos Ropke.

O voto é contado no bairro do **local de votação**, não no da casa do
eleitor: bairros sem escola de votação aparecem zerados (em Porto Alegre:
Jardim Europa, Vila Conceição, Sétimo Céu e São Caetano; em Canoas:
Industrial, Ilha das Graças e Brigadeira).

```bash
npm run dados       # antes: os candidatos vêm de votos.json
npm run municipio   # gera src/dados/municipios/<código IBGE>.json
```

Como os votos chegam aos bairros:

1. **TSE — votação por seção**: votos de cada urna. Deputados vêm de
   `votacao_secao_2026_RS`; presidente, do arquivo nacional
   `votacao_secao_2026_BR` (a eleição federal 6257 sai à parte).
   **TSE — detalhe por seção** (`detalhe_votacao_secao_2026`, arquivos `_RS`
   e `_BR`): aptos,
   comparecimento, abstenções, brancos e nulos de cada urna — dá os eleitores
   dos bairros e as opções brancos, nulos e ausentes. Os nulos por seção não
   trazem os "nulos técnicos" (2 ou 3 votos em Passo Fundo; 548 para deputado
   estadual em Porto Alegre). Os aptos
   são por cargo: na eleição presidencial entram também eleitores em trânsito
   (150.021 em Passo Fundo, contra 149.612 para deputado).
2. **TSE — eleitorado por local de votação** (`eleitorado_local_votacao_2026`):
   cada seção → seu local de votação, com coordenadas e o bairro cadastrado.
3. **Contornos**, conforme `contornos` em `CIDADES` (`scripts/municipio.mjs`),
   com fonte própria para bairros e para distritos:
   - `bairros: 'ibge'` — malha de bairros do Censo 2022, lida do shapefile
     pelo `scripts/shp.mjs` (Porto Alegre, Caxias do Sul, Canoas, Santa
     Maria). Ou a lista
     de IDs de relações do OpenStreetMap, quando o IBGE não delimita os bairros
     (Passo Fundo, Pelotas).
   - `bairros: { arquivo }` — GeoJSON em `scripts/contornos/` (features com
     `id` e `nome`), para divisões que só existem num mapa publicado (Dona
     Francisca). A figura foi segmentada pelas linhas de divisa e
     georreferenciada encaixando o contorno dela no do IBGE (IoU 0,98); a
     borda externa é a da malha de distritos do IBGE e só as divisas internas
     vêm da figura. A fonte fica no campo `fonte` do arquivo.
   - Sem bairros oficiais em lugar nenhum (Gravataí), `bairros` fica de fora
     e a cidade é dividida só pelos distritos; a sede vira um distrito como
     os outros. Contornos estimados não são usados.
   - `distritos: 'ibge'` (malha de distritos) ou `{ osm: [IDs], sede: ID }`,
     só para cidades com interior: entram os distritos e o restante do
     distrito-sede. Sem `distritos`, a cidade é tratada como toda urbana.
   - Relações do OSM às vezes têm um pedaço de divisa faltando; vãos de até
     ~200 m são fechados com uma reta (`VAO_MAX` em `scripts/geo.mjs`) e o
     script avisa quais.
4. Cada local cai no bairro que contém suas coordenadas (`scripts/geo.mjs`).
   Sem coordenadas, ou com o ponto fora de todos os contornos (na água, do
   outro lado da divisa), vale o bairro cadastrado no TSE — e `apelidos`
   resolve nomes que não são bairros (ex.: Ilha das Flores → Arquipélago).

O script confere, para cada opção, que a soma das urnas bate com o resultado
oficial da cidade em `votos.json`. Os **válidos** por bairro podem passar um
pouco do total oficial (0,01% em estadual e 0,2% em federal em Passo Fundo):
o arquivo por seção não separa votos de candidaturas anuladas depois, que o
TSE exclui dos válidos. Só o "% dos válidos" dos bairros sente isso.

Os arquivos do TSE (~640 MB) ficam em `.cache/` e só são baixados uma vez;
o script usa o comando `unzip`. Para outra cidade, acrescente uma entrada em
`CIDADES` com o código TSE e `contornos: { ibge: […] }` (confira antes se o
IBGE tem os bairros dela) ou os IDs das relações do OSM, e rode
`npm run municipio -- <código IBGE>`.

## Como o mapa é desenhado

- **Projeção** (`src/projecao.js`): equirretangular com correção de cosseno na
  latitude média, sem bibliotecas — suficiente para o recorte do RS.
- **Zoom e arraste** (`src/zoom.js`, `src/Mapa.jsx`): roda do mouse (no
  cursor), pinça ou botões +/−/⤢; arrastar move o mapa aproximado (até 16×).
  Sem zoom, afastar a roda e arrastar com um dedo rolam a página normalmente;
  um arraste não conta como clique. Trocar de mapa volta à vista inteira.
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
