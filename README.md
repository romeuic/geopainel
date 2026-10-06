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

A lista de partidos sai dos dados (sigla do TSE de cada opção); um cargo sem
opção do partido escolhido fica desabilitado. A seleção fica na URL
(`?partido=PT&cargo=federal&candidato=1330`; brancos, nulos e ausentes usam
`candidato=brancos|nulos|ausentes`), então o link pode ser
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

Cidades com dados por bairro ganham o botão **Mapa Municipal** no card. Por
ora: **Passo Fundo**. O mapa mostra os 22 bairros (setores da Lei Municipal
Complementar 143/2005), os 6 distritos do interior e o restante do
distrito-sede, com os locais de votação como pontos. O recorte abre na zona
urbana; "Município inteiro" mostra também o interior. Link direto:
`?municipio=4314100`.

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
   trazem os "nulos técnicos" (2 ou 3 votos em Passo Fundo). Os aptos
   são por cargo: na eleição presidencial entram também eleitores em trânsito
   (150.021 em Passo Fundo, contra 149.612 para deputado).
2. **TSE — eleitorado por local de votação** (`eleitorado_local_votacao_2026`):
   cada seção → seu local de votação, com coordenadas e o bairro cadastrado.
3. **OpenStreetMap** — contornos dos bairros e distritos, baixados pela API do
   OSM pelos IDs das relações em `CIDADES` (`scripts/municipio.mjs`). A malha
   de bairros do IBGE (Censo 2022) não serve: para Passo Fundo ela tem um bairro
   só.
4. Cada local cai no bairro que contém suas coordenadas (`scripts/geo.mjs`);
   os poucos locais sem coordenadas usam o bairro cadastrado no TSE.

O script confere, para cada opção, que a soma das urnas bate com o resultado
oficial da cidade em `votos.json`. Os **válidos** por bairro podem passar um
pouco do total oficial (0,01% em estadual e 0,2% em federal em Passo Fundo):
o arquivo por seção não separa votos de candidaturas anuladas depois, que o
TSE exclui dos válidos. Só o "% dos válidos" dos bairros sente isso.

Os arquivos do TSE (~640 MB) ficam em `.cache/` e só são baixados uma vez;
o script usa o comando `unzip`. Para outra cidade, acrescente uma entrada em
`CIDADES` com o código TSE e os IDs das relações do OSM.

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
