# LLM Refactoring Detector

Código e dados do meu Trabalho de Conclusão de Curso em Ciência da Computação (UFOP): **Detecção Automática de Refatorações: Um Estudo Exploratório Utilizando LLMs**, orientado pela Profa. Aline Norberta de Brito.

A pergunta do trabalho é se LLMs conseguem detectar operações de refatoração olhando apenas para o código antes e depois de um commit, sem parser nem análise estática. Foram avaliados dois modelos, GPT-5.4 (OpenAI) e Claude Haiku 4.5 (Anthropic), sobre 150 operações reais de *Extract Method*, *Move Method* e *Rename Method* extraídas do [oráculo de refatorações de Tsantalis et al.](http://refactoring.encs.concordia.ca/oracle), com 50 operações de cada tipo.

## Estrutura

O que importa está em `backend/src/data`:

```
backend/src/data
├── scripts/
│   ├── filterOracle.js            # filtra do oráculo os commits com os 3 tipos validados como TP
│   ├── getCommitsDataSheet.js     # coleta metadados dos commits e repositórios (API do GitHub)
│   ├── buildRefactoringDataset.js # recupera o código-fonte antes/depois de cada operação
│   └── runRefactoring.js          # envia cada operação aos dois LLMs e salva as detecções
└── json/
    ├── oracle.json                # oráculo completo
    ├── oracleDataset.json         # as 150 operações selecionadas
    ├── finalDataset.json          # dataset enriquecido com o código antes/depois
    ├── finalAnalysis_gpt.json     # detecções do GPT-5.4
    ├── finalAnalysis_claude.json  # detecções do Claude Haiku 4.5
    └── ...                        # métricas e tabelas compiladas a partir das detecções
```

## Como rodar

É preciso Node 18 ou superior (os scripts usam `fetch` nativo).

```bash
npm install
```

Crie um `.env` na raiz do projeto:

```
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GITHUB_TOKEN=...
```

O token do GitHub é tecnicamente opcional, mas sem ele o rate limit anônimo da API estoura logo nos primeiros commits.

O pipeline tem quatro etapas, nesta ordem:

```bash
npm run filter-oracle   # 1. filtra o oráculo -> filteredOracle.json
npm run data-sheet      # 2. metadados dos repositórios (stars, forks, autores)
npm run build-dataset   # 3. baixa o código antes/depois de cada operação
npm run run-detection   # 4. consulta os dois LLMs e salva as detecções
```

Os dois modelos recebem exatamente o mesmo prompt, com temperatura 0,2, e são consultados de forma independente. O prompt completo (contexto, persona, definições de Fowler, restrições e formato de saída em JSON) está em `runRefactoring.js`.

Para casos de *Move Method* em que a classe de origem ou destino é criada/removida no próprio commit, o dataset registra um marcador textual no lugar do arquivo, e não código, já que essa evolução faz parte do sinal da refatoração.

## Resultados em uma linha

O GPT-5.4 se mostrou conservador (precisão 0,731, recall 0,333) e o Claude Haiku 4.5, expansivo (precisão 0,537, recall 0,720); a união dos dois eleva o recall a 0,773. A análise completa, incluindo a classificação manual dos 164 falsos positivos, está na monografia e no artigo derivado do trabalho.
