# Repository Guidelines

## Project Structure & Module Organization

```
.
├── 01-consultoria/        # Proposta comercial, contrato e cronograma
│   ├── proposta/
│   ├── contrato/
│   └── cronograma/
├── 02-insumos/            # Dados brutos, referências e notas de reuniões
│   ├── dados/
│   ├── referencia/
│   └── reunioes/
├── 03-produtos/           # Entregáveis (apresentações, gráficos, CSVs, scripts)
├── scripts/               # Tooling Python (extração e análise de planilhas)
└── WHALE.md               # Regras de escrita do projeto
```

- Dados originais do cliente ficam em `02-insumos/dados/`. **Nunca sobrescrevê-los.**
- Cada produto ganha subpasta própria dentro de `03-produtos/`.
- Scripts que geram artefatos devem ser versionados junto com os artefatos.

## Build, Test, and Development Commands

Não há build. Scripts são executados diretamente:

```bash
# Python
python scripts/extrair_planilha.py

# R (gráficos e análise)
"C:\Program Files\R\R-4.3.3\bin\Rscript.exe" 03-produtos/<produto>/script.R
```

R scripts devem usar caminhos relativos (`../../02-insumos/dados/`), nunca absolutos.

## Coding Style & Naming Conventions

### Escrita (WHALE.md)

- **Proibido travessão (—).** Substituir por vírgula, dois-pontos, parênteses ou seta (→).
- Consulte `WHALE.md` antes de escrever qualquer texto no repositório.

### Nomenclatura de arquivos

- CSVs: `snake_case_com_descricao.csv`
- Scripts: `snake_case.R` ou `snake_case.py`, com comentário inicial explicando entrada e saída
- Produtos: `nome-do-produto/` com `graficos/` e `csvs-categoria/` quando aplicável

## Testing Guidelines

Validação manual:

- CSVs gerados devem ser conferidos contra a planilha original antes de uso em reunião
- Gráficos devem ter totais conferidos contra os dados-fonte
- Scripts de categorização geram coluna `Confianca_0_100` — itens abaixo de 65% exigem revisão

## Commit & Pull Request Guidelines

- Commits em português, no imperativo: `Adiciona gráfico de Pareto`, `Corrige categoria das horas paradas`
- Dados brutos em `02-insumos/dados/` não devem ser alterados — apenas adicionados ou substituídos por novas versões do cliente
- Cada produto commitado inclui scripts geradores, gráficos e CSVs exportados juntos
